import React, { useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { useONS } from '../contexts/ONSContext';
import { BarChart3, Users, Globe, TrendingUp, RefreshCw } from 'lucide-react';

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
      color: "text-blue-600 dark:text-blue-400",
      bgColor: "bg-blue-100 dark:bg-blue-900/30"
    },
    {
      title: "Total Users",
      value: globalStats?.total_users || 0,
      icon: Users,
      description: "Unique addresses",
      color: "text-green-600 dark:text-green-400",
      bgColor: "bg-green-100 dark:bg-green-900/30"
    },
    {
      title: "Recent Registrations",
      value: globalStats?.recent_registrations || 0,
      icon: TrendingUp,
      description: "Last 24 hours",
      color: "text-purple-600 dark:text-purple-400",
      bgColor: "bg-purple-100 dark:bg-purple-900/30"
    }
  ];

  return (
    <div className="space-y-6">
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
                <Card key={stat.title} className="hover:bg-accent/50 transition-colors">
                  <CardContent className="p-6">
                    <div className="flex items-center space-x-4">
                      <div className={`p-3 rounded-full ${stat.bgColor}`}>
                        <IconComponent className={`h-6 w-6 ${stat.color}`} />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-muted-foreground">
                          {stat.title}
                        </p>
                        <p className="text-3xl font-bold">
                          {stat.value.toLocaleString()}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {stat.description}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Network Health */}
      <Card className="border-green-500/50 bg-green-50/50 dark:bg-green-950/50">
        <CardContent className="p-6">
          <div className="flex items-center space-x-3">
            <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
            <div>
              <p className="font-medium text-green-700 dark:text-green-300">
                ONS Network Status: Online
              </p>
              <p className="text-sm text-green-600 dark:text-green-400">
                All systems operational • Last updated: {new Date().toLocaleTimeString()}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}