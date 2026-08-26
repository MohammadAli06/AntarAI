# Taste
- When reporting a bug, expects a fast, direct fix with minimal deliberation (repeatedly ends bug reports with "fast" and escalates to "stop wasting my time" when fixes don't land); prefers the agent to jump straight to the root cause and deliver, rather than long explanations or multi-step back-and-forth. Confidence: 0.85
- Prefers React + Tailwind CSS for frontend builds; explicitly specifies the stack and leaves bundler decisions (Vite vs Next.js) to the agent. Confidence: 0.75
- Wants prototype/demo work to function end-to-end against mocked backend responses so the demo looks complete before real models or services are wired in. Confidence: 0.85
- Wants placeholder pages and mock data to be explicitly labeled as placeholders/mocks (e.g., "static/mock for now") rather than passed off as real functionality. Confidence: 0.6
- Prefers project documentation as a root README covering what the project is and how to set up/run both frontend and backend, plus separate READMEs inside each major component directory. Confidence: 0.7
- Expects the design system to be built on semantic theme tokens (CSS variables mapped through Tailwind config) rather than hard-coded hex/utility colors scattered through components. Confidence: 0.7
- Wants theme preference (light/dark) persisted in localStorage and a toggle exposed consistently across all entry surfaces (landing, auth, and main app). Confidence: 0.7
