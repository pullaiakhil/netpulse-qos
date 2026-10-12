import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppLayout } from '@/components/layout/AppLayout';
import { Overview } from '@/pages/Overview';
import { LiveMonitoring } from '@/pages/LiveMonitoring';
import { Targets } from '@/pages/Targets';
import { ThroughputAnalysis } from '@/pages/ThroughputAnalysis';
import { QoSAssessment } from '@/pages/QoSAssessment';
import { Alerts } from '@/pages/Alerts';
import { Reports } from '@/pages/Reports';
import { Settings } from '@/pages/Settings';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 2000,
    },
  },
});

export const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        <Routes>
          <Route element={<AppLayout />}>
            <Route index element={<Overview />} />
            <Route path="monitoring" element={<LiveMonitoring />} />
            <Route path="targets" element={<Targets />} />
            <Route path="throughput" element={<ThroughputAnalysis />} />
            <Route path="qos" element={<QoSAssessment />} />
            <Route path="alerts" element={<Alerts />} />
            <Route path="reports" element={<Reports />} />
            <Route path="settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
};

export default App;
