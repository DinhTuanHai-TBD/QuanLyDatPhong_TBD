import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { App as AntApp, ConfigProvider } from 'antd'
import 'antd/dist/reset.css'
import './index.css'
import App from './App.tsx'

const queryClient = new QueryClient()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ConfigProvider
      theme={{
        token: {
          borderRadius: 8,
          colorPrimary: '#0d2e5c',
          colorInfo: '#0d2e5c',
          colorSuccess: '#2e7d32',
          colorWarning: '#f0ad4e',
          colorError: '#d32f2f',
          fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          colorBorder: '#94a3b8',
          colorBorderSecondary: '#cbd5e1',
          colorSplit: '#94a3b8',
        },
        components: {
          Button: {
            borderRadius: 6,
            controlHeight: 38,
            controlHeightLG: 46,
            fontWeight: 600,
            defaultBorderColor: '#94a3b8',
          },
          Card: {
            borderRadiusLG: 12,
            colorBorderSecondary: '#94a3b8',
          },
          Input: {
            controlHeight: 40,
            borderRadius: 6,
            colorBorder: '#94a3b8',
            hoverBorderColor: '#0d2e5c',
            activeBorderColor: '#0d2e5c',
          },
          Select: {
            controlHeight: 40,
            borderRadius: 6,
            colorBorder: '#94a3b8',
            hoverBorderColor: '#0d2e5c',
            activeBorderColor: '#0d2e5c',
          },
          DatePicker: {
            controlHeight: 40,
            borderRadius: 6,
            colorBorder: '#94a3b8',
            hoverBorderColor: '#0d2e5c',
            activeBorderColor: '#0d2e5c',
          },
          InputNumber: {
            colorBorder: '#94a3b8',
            hoverBorderColor: '#0d2e5c',
          },
          Table: {
            borderRadius: 10,
            headerBg: '#f1f5f9',
            headerColor: '#0f172a',
            borderColor: '#94a3b8',
            headerSplitColor: '#64748b',
          },
          Tabs: {
            titleFontSize: 16,
            horizontalItemPadding: '12px 16px',
          },
        },
      }}
    >
      <AntApp>
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </QueryClientProvider>
      </AntApp>
    </ConfigProvider>
  </StrictMode>,
)
