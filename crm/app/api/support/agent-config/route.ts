import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';

/**
 * Get Agent Configuration for logged-in user
 * Retrieves Ozonetel agent credentials from user_agent_config table
 */
export async function GET(request: NextRequest) {
  try {
    // Get user ID from auth header or session
    // For now, we'll use email from query param for testing
    const searchParams = request.nextUrl.searchParams;
    const email = searchParams.get('email');

    if (!email) {
      return NextResponse.json(
        { error: 'Email parameter is required' },
        { status: 400 }
      );
    }

    console.log('[Agent Config API] Looking up user:', email);

    // Fetch user and their agent config
    const { data: userData, error: userError } = await supabaseServer
      .from('users')
      .select('id, email, full_name, role')
      .eq('email', email)
      .single();

    if (userError) {
      console.error('[Agent Config API] User lookup error:', userError);
      return NextResponse.json(
        { error: 'User not found', details: userError.message },
        { status: 404 }
      );
    }

    if (!userData) {
      console.error('[Agent Config API] No user data returned for:', email);
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    console.log('[Agent Config API] Found user:', { id: userData.id, email: userData.email });

    // Fetch agent config
    const { data: agentConfig, error: configError } = await supabaseServer
      .from('user_agent_config')
      .select('*')
      .eq('user_id', userData.id)
      .single();

    if (configError) {
      console.error('[Agent Config API] Config lookup error:', configError);
      return NextResponse.json(
        {
          success: true, // Changed to true so UI doesn't show error
          error: 'Agent configuration not found',
          message: 'No agent mapping configured for this user',
          hasConfig: false
        },
        { status: 200 } // Changed to 200 so response is processed
      );
    }

    if (!agentConfig) {
      console.warn('[Agent Config API] No agent config found for user:', userData.id);
      return NextResponse.json(
        {
          success: true,
          error: 'Agent configuration not found',
          message: 'Please configure your agent settings',
          hasConfig: false
        },
        { status: 200 }
      );
    }

    console.log('[Agent Config API] Found config:', { agent_id: agentConfig.agent_id, agent_name: agentConfig.agent_name });

    return NextResponse.json({
      success: true,
      user: userData,
      agentConfig: {
        agentId: agentConfig.agent_id,
        agentName: agentConfig.agent_name,
        phoneName: agentConfig.phone_name,
        campaignName: agentConfig.campaign_name,
        skills: agentConfig.skills || [],
        agentModes: agentConfig.agent_modes || [],
        isActive: agentConfig.is_active
      },
      hasConfig: true
    });

  } catch (error) {
    console.error('[Agent Config] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch agent configuration',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * Update Agent Configuration
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      email,
      agentId,
      agentName,
      phoneName,
      campaignName,
      skills,
      agentModes
    } = body;

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    // Get user
    const { data: userData, error: userError } = await supabaseServer
      .from('users')
      .select('id')
      .eq('email', email)
      .single();

    if (userError || !userData) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Upsert agent config
    const { data, error } = await supabaseServer
      .from('user_agent_config')
      .upsert({
        user_id: userData.id,
        agent_id: agentId,
        agent_name: agentName,
        phone_name: phoneName,
        campaign_name: campaignName,
        skills: skills || [],
        agent_modes: agentModes || [],
        is_active: true,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id'
      })
      .select()
      .single();

    if (error) {
      console.error('[Agent Config] Update error:', error);
      return NextResponse.json(
        { error: 'Failed to update agent configuration' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Agent configuration updated successfully',
      agentConfig: {
        agentId: data.agent_id,
        agentName: data.agent_name,
        phoneName: data.phone_name,
        campaignName: data.campaign_name,
        skills: data.skills,
        agentModes: data.agent_modes
      }
    });

  } catch (error) {
    console.error('[Agent Config] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to update agent configuration',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
