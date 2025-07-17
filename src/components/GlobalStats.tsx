import React, { useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { useONS } from '../contexts/ONSContext';
import { BarChart3, Users, Globe, TrendingUp, RefreshCw } from 'lucide-react';
import { Button } from './ui/button';

export function GlobalStats() {
  const { globalStats, refreshGlobalStats } = useONS();

  useEffect(() => {
    // Refresh stats every 30 seconds
    const interval = setInterval(refreshGlobalStats, 30000);
    return () => clearInterval(interval);
  }, [refreshGlobalStats]);

  const stats = [
    {
      title: "Total Domains",
      value: globalStats?.total_domains || 0,
      icon: Globe,
      description: "Registered domains",
      color: "text-blue-600 dark:text-blue-400"
    },
    {
      title: "Total Users",
      value: globalStats?.total_users || 0,
      icon: Users,
      description: "Unique addresses",
      color: "text-green-600 dark:text-green-400"
    },
    {
      title: "Recent Registrations",
      value: globalStats?.recent_registrations || 0,
      icon: TrendingUp,
      description: "Last 24 hours",
      color: "text-purple-600 dark:text-purple-400"
    }
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center space-x-2">
              <BarChart3 className="h-5 w-5" />
              <span>Global Statistics</span>
            </CardTitle>
            <CardDescription>
              ONS network statistics and activity
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={refreshGlobalStats}
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {stats.map((stat) => {
            const IconComponent = stat.icon;
            return (
              <div
                key={stat.title}
                className="p-4 border border-border rounded-lg hover:bg-accent/50 transition-colors"
              >
                <div className="flex items-center space-x-3 mb-2">
                  <div className={`p-2 rounded-full bg-accent ${stat.color}`}>
                    <IconComponent className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      {stat.title}
                    </p>
                  </div>
                </div>
                <div className="ml-11">
                  <p className="text-2xl font-bold">{stat.value.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">{stat.description}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Network Health Indicator */}
        <div className="mt-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-sm font-medium text-green-700 dark:text-green-300">
              ONS Network Status: Online
            </span>
          </div>
          <p className="text-xs text-green-600 dark:text-green-400 mt-1">
            All systems operational • Last updated: {new Date().toLocaleTimeString()}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}