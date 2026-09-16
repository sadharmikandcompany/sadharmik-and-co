import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';

/**
 * Check if any agents are available (READY state) to take calls
 *
 * This endpoint checks agent status from the agent_status table,
 * which is populated in real-time by Ozonetel webhooks.
 *
 * Data source: agent_status table (updated by /api/webhooks/ozonetel/realtime)
 */
export async function GET() {
  try {
    console.log('[Agent Availability] Checking agent availability from webhook data...');

    // Query agent_status table for all currently logged-in agents
    // Agents are removed from this table when they log out, so we can trust all records
    // Still filter by last 2 hours to handle any cleanup issues
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

    const { data: agents, error } = await supabaseServer
      .from('agent_status')
      .select('*')
      .gte('updated_at', twoHoursAgo)
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('[Agent Availability] Database error:', error);
      throw error;
    }

    // Consider all logged-in agents as "available" for showing calls
    // This includes READY, IDLE, BUSY, INCALL, etc. - any agent who is logged in
    // We only want to hide calls if NO agents are logged in at all
    const loggedInAgents = (agents || []).filter((agent: any) =>
      agent.agent_state !== 'OFFLINE'
    );
    const isAvailable = loggedInAgents.length > 0;

    // Also track how many are specifically ready to take NEW calls
    const readyAgents = (agents || []).filter((agent: any) =>
      agent.agent_state === 'READY' || agent.agent_state === 'IDLE'
    );

    // Calculate agent state distribution
    const agentStates = (agents || []).reduce((acc: any, agent: any) => {
      acc[agent.agent_state] = (acc[agent.agent_state] || 0) + 1;
      return acc;
    }, {});

    console.log('[Agent Availability] Result from webhooks:', {
      isAvailable,
      totalAgents: agents?.length || 0,
      loggedInAgents: loggedInAgents.length,
      readyAgents: readyAgents.length,
      agentStates
    });

    return NextResponse.json({
      success: true,
      isAvailable, // True if ANY agents are logged in (even if BUSY)
      apiWorking: true, // Webhook data is working
      dataSource: 'realtime_webhooks', // Indicates we're using webhook data
      stats: {
        totalAgents: agents?.length || 0,
        loggedInAgents: loggedInAgents.length, // All logged-in agents (any state)
        readyAgents: readyAgents.length, // Only READY/IDLE agents
        agentStates
      },
      readyAgentList: readyAgents.map((agent: any) => ({
        agentId: agent.agent_id,
        agentName: agent.agent_name,
        agentState: agent.agent_state,
        skills: agent.skill_name,
        phoneNumber: agent.phone_number,
        lastAction: agent.last_action,
        lastEventTime: agent.last_event_time
      })),
      allAgentsList: (agents || []).map((agent: any) => ({
        agentId: agent.agent_id,
        agentName: agent.agent_name,
        agentState: agent.agent_state,
        lastAction: agent.last_action,
        lastEventTime: agent.last_event_time
      })),
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[Agent Availability] Error:', error);
    return NextResponse.json(
      {
        success: true, // Still return success
        isAvailable: true, // Default to available (show calls) on error
        apiWorking: false,
        dataSource: 'fallback',
        warning: 'Unable to fetch agent status - showing all calls by default',
        error: 'Failed to check agent availability',
        message: error instanceof Error ? error.message : 'Unknown error',
        stats: {
          totalAgents: 0,
          loggedInAgents: 0,
          readyAgents: 0,
          agentStates: {}
        },
        readyAgentList: [],
        allAgentsList: [],
        timestamp: new Date().toISOString()
      },
      { status: 200 } // Return 200, not 500, so the UI still works
    );
  }
}
