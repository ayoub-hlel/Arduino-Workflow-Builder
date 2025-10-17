# Arduino Workflow Builder

Arduino Workflow Builder is a visual programming platform for Arduino development, designed to make learning electronics and programming accessible through drag-and-drop block programming. Built with SvelteKit, it provides real-time circuit simulation and code generation.

![Arduino Workflow Builder Interface](static/logo.png)

## 🚀 Quick Start Guide

### Prerequisites

- **Node.js 18+** and npm
- **Git** for version control  
- A modern web browser
- (Optional) **Arduino IDE** for uploading generated code to real Arduino boards

### 📋 Step-by-Step Setup

#### 1. Clone and Install

```bash
# Clone the repository
git clone https://github.com/ayoub-hlel/Arduino-Workflow-Builder.git
cd Arduino-Workflow-Builder

# Install dependencies
npm install
```

#### 2. Set Up Authentication (Clerk)

Arduino Workflow Builder uses [Clerk](https://clerk.com) for user authentication and management.

1. **Create a Clerk Account**
   - Go to [https://clerk.com](https://clerk.com)
   - Sign up for a free account
   - Create a new application

2. **Configure OAuth Providers**
   - In your Clerk dashboard, go to **User & Authentication > Social Providers**
   - Enable **Google** (recommended for ease of use)
   - Configure any other providers you want (GitHub, Discord, etc.)

3. **Get Your Publishable Key**
   - Go to **API Keys** in your Clerk dashboard
   - Copy the **Publishable Key** (starts with `pk_test_` or `pk_live_`)
   - Keep this handy for step 4

#### 3. Set Up Database (Convex)

Arduino Workflow Builder uses [Convex](https://convex.dev) for real-time database and backend functions.

1. **Create a Convex Account**
   - Go to [https://convex.dev](https://convex.dev)
   - Sign up for a free account
   - Install the Convex CLI globally:
   ```bash
   npm install -g convex
   ```

2. **Initialize Your Convex Project**
   ```bash
   # In your Arduino Workflow Builder directory
   npx convex dev
   ```
   - Follow the prompts to create a new project
   - This will create a `convex/` directory with your backend functions
   - Copy the deployment URL (looks like `https://your-project.convex.cloud`)

3. **Deploy the Schema**
   - The project already includes the database schema in `convex/schema.ts`
   - Convex will automatically deploy this when you run `npx convex dev`

#### 4. Configure Environment Variables

```bash
# The project uses src/env.ts for configuration
# Update this file with your API keys:

# Open src/env.ts in your editor and update:
```

```typescript
export default {
  clerk: {
    publishableKey: "pk_test_YOUR_CLERK_KEY_HERE", // Your Clerk publishable key
  },
  convex: {
    url: "https://your-project.convex.cloud", // Your Convex deployment URL
  },
  server_arduino_url: "https://compile-staging.arduino-workflow-builder.org", // Arduino compilation service
  bucket_name: "arduino-workflow-builder-lesson-staging", // Asset storage
  useEmulator: false,
  site: "arduino-workflow-builder-local", // Your site identifier
};
```

#### 5. Start Development

#### 5. Start Development

```bash
# Make sure Convex is running (in a separate terminal)
npx convex dev

# Start the development server
npm run dev
```

6. **Open Your Browser**
   - Navigate to `http://localhost:5173`
   - You should see the Arduino Workflow Builder interface
   - Try signing in with your configured OAuth provider

### 🧪 Testing Your Setup

1. **Create an Account**
   - Click "Sign In" and create a new account using Google (or your configured provider)
   - You should be redirected back to the app

2. **Create a Project**
   - Click "Create New Project"
   - Try dragging some blocks in the visual editor
   - Your project should auto-save

3. **Test Circuit Simulation**
   - Add an LED block and a digital output block
   - Connect them together
   - Click the "Play" button to see the simulation

### 🔧 API Keys Reference

Here are all the services and their required keys:

| Service | Purpose | Required | How to Get |
|---------|---------|----------|------------|
| **Clerk** | User authentication | ✅ Yes | [clerk.com](https://clerk.com) → Create App → API Keys |
| **Convex** | Database & real-time updates | ✅ Yes | [convex.dev](https://convex.dev) → Create Project → `npx convex dev` |
| **Arduino Compiler** | Code compilation | ⚠️ Optional* | Uses staging service by default |
| **Asset Storage** | Lesson assets | ⚠️ Optional* | Uses staging bucket by default |

*Optional services use staging/demo endpoints that work out of the box for development.

### 🚨 Troubleshooting

#### Authentication Issues
```bash
# If you see "Clerk not initialized" errors:
1. Check your publishableKey in src/env.ts
2. Make sure it starts with pk_test_ or pk_live_
3. Verify Google OAuth is enabled in Clerk dashboard
```

#### Database Connection Issues
```bash
# If you see "Convex connection failed" errors:
1. Make sure `npx convex dev` is running in another terminal
2. Check your Convex URL in src/env.ts
3. Verify the URL format: https://your-project.convex.cloud
```

#### Build Errors
```bash
# If npm run dev fails:
1. Delete node_modules and package-lock.json
2. Run: npm install
3. Make sure Node.js version is 18+
4. Check that src/env.ts exists and is properly formatted
```

### 📱 Mobile Development

Arduino Workflow Builder works on mobile devices:

1. **Start the dev server with network access:**
   ```bash
   npm run dev -- --host
   ```

2. **Find your IP address:**
   ```bash
   # On Linux/Mac:
   ip addr show | grep inet
   # On Windows:
   ipconfig
   ```

3. **Access on mobile:**
   - Go to `http://YOUR_IP:5173` on your mobile device
   - Make sure both devices are on the same network

### 🔄 Environment Configurations

The project supports multiple environments:

```bash
# Development (default)
npm run dev
# Uses: env/env.development.ts

# Staging
npm run build
# Uses: env/env.staging.ts  

# Production
# Uses: env/env.prod.ts
```

### 🎯 Using Arduino Workflow Builder

#### Creating Your First Project

1. **Sign In**
   - Use the "Sign In" button in the top right
   - Authenticate with your preferred OAuth provider

2. **Create a New Project**
   - Click "Create New Project" on the dashboard
   - Give your project a descriptive name
   - Choose your Arduino board type (Uno, Nano, Mega)

3. **Visual Programming**
   - **Drag blocks** from the toolbox on the left
   - **Connect blocks** by dragging from one block to another
   - **Configure blocks** by clicking on their parameters
   - **See live updates** in the virtual circuit on the right

4. **Generate Arduino Code**
   - Your blocks automatically generate Arduino C++ code
   - View the code in the "Code" tab
   - Copy and paste into Arduino IDE to upload to your board

#### Available Block Categories

- **🔌 Input/Output**: Digital and analog pins, PWM
- **🚨 Sensors**: Temperature, light, motion sensors  
- **💡 Actuators**: LEDs, servos, motors
- **🎛️ Logic**: If/else, loops, variables
- **⏱️ Time**: Delays, timers, scheduling
- **🔢 Math**: Arithmetic, comparison, functions
- **📡 Communication**: Serial, I2C, SPI protocols

#### Virtual Circuit Features

- **Real-time simulation** of your Arduino program
- **Visual feedback** showing LED states, sensor readings
- **Interactive components** you can click and test
- **Oscilloscope view** for signal analysis
- **Error highlighting** for connection issues

### 🛠️ Development & Customization

#### Adding Custom Blocks

1. **Create block definition** in `src/blocks/your-category/`
2. **Add to toolbox** in `src/core/blockly/toolbox.ts`
3. **Implement code generation** in the block's `generateCode()` method
4. **Test with virtual circuit** integration

#### Custom Arduino Libraries

1. **Add library files** to `static/libraries/`
2. **Update compilation service** configuration
3. **Create corresponding blocks** for library functions
4. **Document usage** in help system

#### Extending the Virtual Circuit

1. **Add new components** in `src/core/virtual-circuit/components/`
2. **Implement simulation logic** for realistic behavior  
3. **Create visual representations** with SVG
4. **Test interaction** with block programming

## 🏗️ Architecture

Arduino Workflow Builder uses a modern, scalable architecture:

- **Frontend**: SvelteKit with TypeScript
- **Authentication**: Clerk for secure user management
- **Database**: Convex for real-time, type-safe data operations
- **Block Editor**: Google Blockly for visual programming
- **Circuit Simulation**: Custom SVG-based virtual circuit
- **Code Generation**: Real-time Arduino C++ code generation

### Key Features

- 🎯 **Visual Programming**: Drag-and-drop block interface
- 🔄 **Real-time Simulation**: Live circuit simulation
- 📱 **Responsive Design**: Works on desktop and mobile
- 🔐 **Secure Authentication**: OAuth integration via Clerk
- 💾 **Auto-save**: Automatic project backup and sync
- 🌐 **Offline Support**: Limited editing when offline
- 📊 **Performance Monitoring**: Sub-200ms authentication, sub-500ms queries

## 🛠️ Development

### Project Structure

```
Arduino Workflow Builder/
├── src/
│   ├── components/          # Svelte components
│   │   ├── auth/           # Authentication components
│   │   └── arduino-workflow-builder/  # Core app components
│   ├── routes/             # SvelteKit routing
│   │   ├── (blockly)/     # Main app routes
│   │   └── (fullpage)/    # Full-page routes
│   ├── stores/            # Svelte stores for state
│   ├── core/              # Core logic
│   │   ├── blockly/       # Blockly integration
│   │   ├── microcontroller/ # Arduino simulation
│   │   └── virtual-circuit/  # Circuit simulation
│   ├── blocks/            # Custom Blockly blocks
│   └── helpers/           # Utility functions
├── convex/                # Convex backend functions
│   ├── auth.ts           # Authentication queries/mutations
│   ├── projects.ts       # Project CRUD operations
│   ├── users.ts          # User data operations
│   └── schema.ts         # Database schema
└── static/               # Static assets
```

### Available Scripts

```bash
# Development
npm run dev              # Start dev server
npm run build           # Build for production
npm run preview         # Preview production build

# Testing
npm test                # Run unit tests
npm run test-coverage   # Run tests with coverage

# Code Quality
npm run check           # Type checking
npm run check:watch     # Type checking in watch mode
