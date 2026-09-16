import { NextRequest, NextResponse } from 'next/server';
import { getMyOperatorConfig, getUsers } from '@/lib/services/myoperator';

/**
 * MyOperator Agent Configuration
 * Maps logged-in user email to their MyOperator agent details.
 * Uses hardcoded mapping from MyOperator dashboard + live API lookup for user IDs.
 */

// Agent mapping from MyOperator dashboard (screenshot data).
// Cleared of the previous business's real staff — fill in Sadharmik & Co's
// own agents (email → MyOperator extension/phone) once MyOperator is set up.
const MYOPERATOR_AGENTS: Record<string, {
  name: string;
  role: string;
  extension: string;
  phone: string;
  userId?: string;
  showAllAgents?: boolean;
}> = {
  'admin@sadharmikandco.com': {
    name: 'Admin',
    role: 'Admin',
    extension: '00',
    phone: '',
    showAllAgents: true,
  },
};

/**
 * GET /api/myoperator/agent-config?email=xxx
 * Returns the MyOperator agent config for the logged-in user
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const email = searchParams.get('email');

    if (!email) {
      return NextResponse.json(
        { error: 'Email parameter is required' },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase();
    console.log('[MyOperator Agent Config] Looking up:', normalizedEmail);

    // Check hardcoded mapping first
    const hardcodedAgent = MYOPERATOR_AGENTS[normalizedEmail];

    if (hardcodedAgent) {
      // Try to enrich with MyOperator user ID from API
      let userId = hardcodedAgent.userId;

      if (!userId) {
        try {
          const config = getMyOperatorConfig();
          if (config.token && config.apiKey) {
            const usersResult = await getUsers(config, { all: true });

            if (usersResult.success && usersResult.data) {
              const phoneDigits = hardcodedAgent.phone.replace(/\D/g, '').slice(-10);
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const matchedUser = usersResult.data.find((u: any) =>
                u.email?.toLowerCase() === normalizedEmail ||
                u.number?.includes(phoneDigits) ||
                u.phone?.includes(phoneDigits)
              );

              if (matchedUser) {
                userId = matchedUser.id || matchedUser.user_id;
                console.log('[MyOperator Agent Config] Found user ID:', userId, 'for', normalizedEmail);
              }
            }
          }
        } catch (err) {
          console.error('[MyOperator Agent Config] Error enriching user ID:', err);
        }
      }

      return NextResponse.json({
        success: true,
        hasConfig: true,
        agentConfig: {
          name: hardcodedAgent.name,
          role: hardcodedAgent.role,
          extension: hardcodedAgent.extension,
          phone: hardcodedAgent.phone,
          email: normalizedEmail,
          userId: userId || null,
          showAllAgents: hardcodedAgent.showAllAgents || false,
        },
      });
    }

    // Not found in hardcoded mapping - try MyOperator API directly
    try {
      const config = getMyOperatorConfig();
      if (config.token && config.apiKey) {
        const usersResult = await getUsers(config, { keyword: normalizedEmail });

        if (usersResult.success && usersResult.data && usersResult.data.length > 0) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const user = usersResult.data[0] as any;
          return NextResponse.json({
            success: true,
            hasConfig: true,
            agentConfig: {
              name: user.name || user.user_name || 'Unknown',
              role: user.role || 'Agent',
              extension: user.extension || '',
              phone: user.number || user.phone || '',
              email: normalizedEmail,
              userId: user.id || user.user_id || null,
            },
          });
        }
      }
    } catch (err) {
      console.error('[MyOperator Agent Config] API lookup error:', err);
    }

    console.log('[MyOperator Agent Config] No config found for:', normalizedEmail);
    return NextResponse.json({
      success: true,
      hasConfig: false,
      message: 'No MyOperator agent config found for this email',
    });

  } catch (error) {
    console.error('[MyOperator Agent Config] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch agent config' },
      { status: 500 }
    );
  }
}
