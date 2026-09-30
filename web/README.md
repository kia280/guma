# Guma Web Frontend

Modern guild management system frontend built with Next.js, React, and HeroUI.

## 🚀 Features

- **Modern Tech Stack**: Next.js 15, React 19, TypeScript, HeroUI, Tailwind CSS
- **Authentication**: OAuth2 integration with automatic token refresh
- **State Management**: React Query for server state, Zustand for client state
- **Responsive Design**: Mobile-first approach with PWA support
- **Plugin System**: Extensible plugin architecture
- **Internationalization**: Multi-language support with next-intl
- **Accessibility**: WCAG 2.1 AA compliant
- **Testing**: Jest, React Testing Library, Cypress
- **Performance**: Optimized builds, code splitting, caching strategies

## 📁 Project Structure

```
web/
├── public/
│   └── assets/logo/          # Application logos
├── src/
│   ├── app/                  # Next.js app directory
│   │   ├── (dashboard)/      # Protected dashboard routes
│   │   ├── guilds/           # Guild management pages
│   │   ├── login/            # Authentication pages
│   │   ├── globals.css       # Global styles
│   │   ├── layout.tsx        # Root layout
│   │   ├── page.tsx          # Home page
│   │   └── providers.tsx     # React providers
│   ├── components/           # Reusable components
│   │   └── Navigation.tsx    # Main navigation
│   ├── hooks/                # Custom React hooks
│   │   └── useGuilds.ts      # Guild-related hooks
│   ├── lib/                  # Utility libraries
│   │   ├── auth/             # Authentication context
│   │   ├── plugins/          # Plugin system
│   │   ├── api.ts            # API client
│   │   └── store.ts          # Zustand stores
|   ├── locales/              # i18n locale files
│   └── types/                # TypeScript definitions
│       └── api.ts            # API type definitions
├── .env.example              # Environment variables template
├── .env.local                # Local environment variables
├── eslint.config.mjs         # ESLint configuration
├── .prettierrc.js            # Prettier configuration
├── jest.config.js            # Jest testing configuration
├── jest.setup.js             # Jest setup file
├── next.config.mjs           # Next.js configuration
├── package.json              # Dependencies and scripts
├── postcss.config.js         # PostCSS configuration
├── tailwind.config.ts        # Tailwind CSS configuration
└── tsconfig.json             # TypeScript configuration
```

## 🛠️ Installation

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Set up environment variables**:
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your configuration
   ```

3. **Start development server**:
   ```bash
   npm run dev
   ```

## 📋 Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run dev:demo` - Start a development server in demo mode
- `npm run build:demo` - Build the static demo into `out-demo`
- `npm run serve:demo` - Serve the static demo from `out-demo`
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Fix ESLint issues
- `npm run format` - Format code with Prettier
- `npm run test` - Run Jest tests
- `npm run test:watch` - Run tests in watch mode
- `npm run test:e2e` - Run Cypress tests
- `npm run test:e2e:open` - Open Cypress test runner
- `npm run storybook` - Start Storybook
- `npm run build-storybook` - Build Storybook

## 🎭 Demo Mode

`npm run build:demo` builds a static, frontend-only demo that runs on the mock data, with a role picker instead of Discord login. See [`docs/demo.md`](../docs/demo.md) for how it works and how to deploy it.

## 🔧 Configuration

### Environment Variables

```env
# API Configuration
NEXT_PUBLIC_API_URL=http://localhost:8080/api
NEXT_PUBLIC_WS_URL=ws://localhost:8080/ws

# OAuth Configuration
NEXT_PUBLIC_DISCORD_CLIENT_ID=your_discord_client_id
NEXT_PUBLIC_OAUTH_REDIRECT_URI=http://localhost:3000/auth/callback

# Support channels (optional; the Discord card is hidden when unset)
NEXT_PUBLIC_DISCORD_INVITE_URL=

# Feature Flags
NEXT_PUBLIC_ENABLE_PWA=true
NEXT_PUBLIC_ENABLE_NOTIFICATIONS=true
NEXT_PUBLIC_ENABLE_OFFLINE_MODE=true
```

### API Client

The API client is pre-configured with:
- Automatic token refresh
- Request/response interceptors
- Error handling
- TypeScript support

```typescript
import { api } from '@/lib/api';

// GET request
const guilds = await api.get<Guild[]>('/guilds');

// POST request
const newGuild = await api.post<Guild>('/guilds', { name: 'My Guild' });
```

### State Management

#### React Query (Server State)
```typescript
import { useQuery } from '@tanstack/react-query';

const { data, isLoading, error } = useQuery({
  queryKey: ['guilds'],
  queryFn: () => api.get('/guilds'),
});
```

#### Zustand (Client State)
```typescript
import { useUIStore } from '@/lib/store';

const { sidebarOpen, toggleSidebar } = useUIStore();
```

### Authentication

```typescript
import { useAuth } from '@/lib/auth/auth-context';

const { user, login, logout, hasPermission } = useAuth();

// Protected routes
<ProtectedRoute permissions={['guild.read']}>
  <GuildDashboard />
</ProtectedRoute>
```

## 🎨 UI Components

Built with HeroUI (NextUI successor) for consistent, accessible components:

```typescript
import { Button, Card, Modal } from '@heroui/react';

<Button color="primary" size="lg">
  Join Guild
</Button>
```

### Theme Support

- Light/Dark mode toggle
- Custom color schemes
- Responsive design tokens
- CSS variables for customization

## 🔌 Plugin System

Extensible plugin architecture for adding custom functionality:

```typescript
// Plugin registration
export const pluginComponents: PluginComponent[] = [
  {
    name: 'guild-dashboard',
    component: GuildDashboard,
    route: '/plugins/guild-dashboard',
    permissions: ['guild.read'],
    navItem: {
      label: 'Dashboard',
      icon: DashboardIcon,
      order: 1
    }
  }
];
```

## 🌐 Internationalization

Multi-language support with next-intl:

```typescript
import { useTranslations } from 'next-intl';

const t = useTranslations('Navigation');
return <span>{t('dashboard')}</span>;
```

## 📱 Progressive Web App

- Service worker for offline functionality
- App manifest for native-like experience
- Push notifications support
- Background sync capabilities

## 🧪 Testing

### Unit Tests (Jest + React Testing Library)
```bash
npm run test
```

### End-to-End Tests (Cypress)
```bash
npm run test:e2e
```

### Component Tests (Storybook)
```bash
npm run storybook
```

## 🚀 Deployment

### Production Build
```bash
npm run build
npm run start
```

### Docker
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

## 📚 Documentation

- [Frontend Specification](../spec/frontend-specification.md)
- [Plugin Development Guide](../docs/plugin-development-guide.md)
- [Development Guide](../docs/development.md)

## 🤝 Contributing

See [CONTRIBUTING.md](../CONTRIBUTING.md) for the development workflow, conventions, checks, and the terms under which contributions are accepted.

## 📄 License

Copyright (C) 2026 K1a

This project is licensed under the Elastic License 2.0 (Elastic-2.0). See the [LICENSE](../LICENSE) file for the full text.

The license does not allow providing the software to third parties as a hosted or managed service that gives them access to a substantial set of its features.

## 🔗 Links

- [HeroUI Documentation](https://heroui.com/)
- [Next.js Documentation](https://nextjs.org/docs)
- [Tailwind CSS](https://tailwindcss.com/)
- [React Query](https://tanstack.com/query)
- [Zustand](https://zustand-demo.pmnd.rs/)
