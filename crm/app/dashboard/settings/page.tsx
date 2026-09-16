'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Save, RefreshCw, CheckCircle, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [agentConfig, setAgentConfig] = useState({
    agentId: '',
    agentName: '',
    campaignName: '',
    skills: [] as string[],
    agentModes: [] as string[],
    isActive: true
  });
  const [hasConfig, setHasConfig] = useState(false);

  useEffect(() => {
    // TODO: Get email from authenticated user session
    // For now, using a test email - replace with actual auth
    const email = 'zeel@kalapurna.in'; // Replace with: auth.user.email
    setUserEmail(email);
    fetchAgentConfig(email);
  }, []);

  const fetchAgentConfig = async (email: string) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/support/agent-config?email=${encodeURIComponent(email)}`);
      const data = await response.json();

      if (data.success && data.hasConfig) {
        setAgentConfig(data.agentConfig);
        setHasConfig(true);
      } else {
        setHasConfig(false);
      }
    } catch (error) {
      console.error('Error fetching agent config:', error);
      toast.error('Failed to load agent configuration');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!agentConfig.agentId || !agentConfig.campaignName) {
      toast.error('Agent ID and Campaign Name are required');
      return;
    }

    setSaving(true);
    try {
      const response = await fetch('/api/support/agent-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: userEmail,
          ...agentConfig
        })
      });

      const data = await response.json();

      if (data.success) {
        toast.success('Agent configuration saved successfully');
        setHasConfig(true);
      } else {
        toast.error(data.error || 'Failed to save configuration');
      }
    } catch (error) {
      console.error('Error saving agent config:', error);
      toast.error('Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Agent Settings</h1>
        <p className="text-muted-foreground">
          Configure your Ozonetel agent credentials for call center operations
        </p>
      </div>

      {/* Status Badge */}
      <div>
        {hasConfig ? (
          <Badge variant="default" className="gap-2">
            <CheckCircle className="h-3 w-3" />
            Configuration Active
          </Badge>
        ) : (
          <Badge variant="destructive" className="gap-2">
            <AlertCircle className="h-3 w-3" />
            Not Configured
          </Badge>
        )}
      </div>

      {/* Configuration Form */}
      <Card>
        <CardHeader>
          <CardTitle>Ozonetel Agent Credentials</CardTitle>
          <CardDescription>
            Your agent ID and campaign settings for making and receiving calls
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* User Email (Read-only) */}
          <div className="space-y-2">
            <Label htmlFor="email">Your Email (Read-only)</Label>
            <Input
              id="email"
              type="email"
              value={userEmail}
              disabled
              className="bg-muted"
            />
          </div>

          <Separator />

          {/* Agent ID */}
          <div className="space-y-2">
            <Label htmlFor="agentId">Agent ID *</Label>
            <Input
              id="agentId"
              placeholder="e.g., zeel, Ronit, BHAVYA"
              value={agentConfig.agentId}
              onChange={(e) => setAgentConfig({ ...agentConfig, agentId: e.target.value })}
            />
            <p className="text-sm text-muted-foreground">
              Your unique agent identifier in Ozonetel (case-sensitive)
            </p>
          </div>

          {/* Agent Name */}
          <div className="space-y-2">
            <Label htmlFor="agentName">Agent Name</Label>
            <Input
              id="agentName"
              placeholder="e.g., Zeel Koradia"
              value={agentConfig.agentName}
              onChange={(e) => setAgentConfig({ ...agentConfig, agentName: e.target.value })}
            />
          </div>

          {/* Campaign Name */}
          <div className="space-y-2">
            <Label htmlFor="campaignName">Campaign Name *</Label>
            <Input
              id="campaignName"
              placeholder="e.g., General, Sales, Support"
              value={agentConfig.campaignName}
              onChange={(e) => setAgentConfig({ ...agentConfig, campaignName: e.target.value })}
            />
            <p className="text-sm text-muted-foreground">
              The campaign you are assigned to in Ozonetel
            </p>
          </div>

          <Separator />

          {/* Skills (Read-only for now) */}
          <div className="space-y-2">
            <Label>Skills</Label>
            <div className="flex flex-wrap gap-2">
              {agentConfig.skills.length > 0 ? (
                agentConfig.skills.map((skill, index) => (
                  <Badge key={index} variant="secondary">
                    {skill}
                  </Badge>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No skills configured</p>
              )}
            </div>
          </div>

          {/* Agent Modes (Read-only for now) */}
          <div className="space-y-2">
            <Label>Agent Modes</Label>
            <div className="flex flex-wrap gap-2">
              {agentConfig.agentModes.length > 0 ? (
                agentConfig.agentModes.map((mode, index) => (
                  <Badge key={index} variant="outline">
                    {mode}
                  </Badge>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No modes configured</p>
              )}
            </div>
          </div>

          <Separator />

          {/* Save Button */}
          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => fetchAgentConfig(userEmail)}
              disabled={loading}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Reload
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save Configuration
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Help Card */}
      <Card>
        <CardHeader>
          <CardTitle>Need Help?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            <strong>Where to find your Agent ID?</strong>
          </p>
          <p className="text-muted-foreground">
            Login to your Ozonetel CloudAgent dashboard and check under Agent Settings.
            The Agent ID is displayed next to your name (case-sensitive).
          </p>
          <p className="mt-4">
            <strong>What is Campaign Name?</strong>
          </p>
          <p className="text-muted-foreground">
            The campaign name is the default campaign you are assigned to for making calls.
            Common names are: General, Sales, Support, Inbound, etc.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
