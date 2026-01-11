# my-tool (ESM)

> Professional Express.js backend scaffolded with **nxpcli** (Najim's Express CLI)  
> Fully TypeScript-based, modular, and production-ready.

---

## Table of Contents

- [Project Overview](#project-overview)  
- [Getting Started](#getting-started)  
- [Installation](#installation)  
- [Usage](#usage)  
- [Project Structure](#project-structure)  
- [Modules](#modules)  
- [Included Technologies](#included-technologies)  
- [Environment Variables](#environment-variables)  
- [Scripts](#scripts)  
- [Linting & Formatting](#linting--formatting)  
- [Git Hooks](#git-hooks)  
- [Contributing](#contributing)  
- [License](#license)  
- [Contact](#contact)  

---

## Project Overview

`my-tool` is a professional Express.js backend project generated using **nxpcli**.  
It is designed for scalability, maintainability, and fast development.

Key features:

- **TypeScript First:** Full TS support for type safety.  
- **Modular Architecture:** Separate folders for modules, controllers, services, routes, and validations.  
- **Request Logging:** Automatic logging using **pino-http**.  
- **Error Handling:** Global error handler with detailed responses.  
- **Environment Ready:** Uses **dotenv** for environment configuration.  
- **Pre-configured Tools:** ESLint, Prettier, Husky, lint-staged for best practices.  

---

## Getting Started

### Prerequisites

- Node.js >= 20  
- npm >= 9  
- MongoDB database (local or cloud)

---

## Installation

Clone the repository or generate a new project with nxpcli:

```bash
nxpcli create project my-tool
cd my-tool
npm install
```

---

## Usage

### Development

```bash
npm run dev
```

Server will start on `http://localhost:5000` (or the port defined in `.env`).

### Production

```bash
npm run build
npm start
```

---

## Project Structure

```
my-tool/
├─ src/
│  ├─ modules/          # Feature modules (controller, service, route, validation)
│  ├─ middlewares/      # Global middlewares
│  ├─ utils/            # Utility functions and logger
│  ├─ config/           # Environment & configuration
│  ├─ server.ts         # Entry point
├─ .env                 # Environment variables
├─ package.json
├─ tsconfig.json
└─ README.md
```

---

## Modules

Each module contains:

- Controller  
- Service  
- Route  
- Validation  
- (Optional) Model & TypeScript interface if `--model` flag is used  

Generate a new module:

```bash
nxpcli create module <module-name> --model
```

---

## Included Technologies

### Core Dependencies

| Package       | Description                               |
|---------------|-------------------------------------------|
| express       | Fast, minimalist web framework            |
| mongoose      | MongoDB object modeling                     |
| typescript    | Superset of JavaScript with types          |
| zod           | Schema validation with TypeScript support  |
| pino          | Fast logger for Node.js                     |
| pino-http     | HTTP request logger                         |
| cors          | Cross-origin middleware                     |
| dotenv        | Load environment variables                  |

### Development Dependencies

| Package       | Description                               |
|---------------|-------------------------------------------|
| nodemon       | Auto-restart server on file changes       |
| eslint        | Linter for JS/TS                           |
| prettier      | Code formatter                             |
| husky         | Git hooks manager                           |
| lint-staged   | Run linters on staged files                 |
| ts-node       | TypeScript execution                        |
| pino-pretty   | Pretty-print pino logs                       |

---

## Environment Variables

Create a `.env` file at project root:

| Variable       | Description                               | Default                                         |
|----------------|-------------------------------------------|-------------------------------------------------|
| NODE_ENV        | Environment mode                           | development                                     |
| PORT            | Server port                                | 5000                                            |
| DATABASE_URL    | MongoDB connection string                  | mongodb://127.0.0.1:27017/<your_database_name> |

---

## Scripts

| Script         | Description                               |
|----------------|-------------------------------------------|
| npm run dev    | Start server in development mode          |
| npm run build  | Compile TypeScript to JavaScript          |
| npm start      | Run production server                      |

---

## Linting & Formatting

- **ESLint:** Linting rules for TypeScript & Node.js  
- **Prettier:** Code formatting  
- Run lint: `npm run lint`  
- Run format: `npm run format`  

---

## Git Hooks

Configured with Husky & lint-staged:

- Pre-commit hooks to lint and format staged files  

---

## Contributing

If you wish to contribute:

1. Fork the repository  
2. Create a feature branch  
3. Commit your changes with clear messages  
4. Open a pull request  

---

## License

MIT License  

---

## Contact (nxpcli Developer)

> Note: The contact information below is for **nxpcli CLI developer**, not the generated project.

- **Developer:** Najim  
- **Email:** itsnajim.mail@gmail.com  
- **GitHub:** [https://github.com/najim2004](https://github.com/najim2004)
- **Portfolio:** [https://najim.vercel.app](https://najim.vercel.app)  
- **LinkedIn:** [https://linkedin.com/in/its-najim](https://linkedin.com/in/its-najim)  

---

Happy Coding! 🚀
