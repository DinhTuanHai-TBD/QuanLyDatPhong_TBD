# Prompt for Google AI Studio

You are improving an existing frontend for a university room-booking system.
Read `AI_STUDIO_BRIEF.md` first and treat it as a strict contract.

The uploaded project is a React 19 + TypeScript + Vite application. It uses
Ant Design, React Router, Axios, and TanStack Query. Preserve these choices.

Your task is to improve the visual design and user experience while keeping
the current pages and API integration working:

1. Preserve separate pages for `/bookings` (create a booking) and
   `/booking-history` (booking history). Do not combine them into tabs.
2. Keep the existing university visual identity: navy header/footer, supplied
   logo and room images in `public/images`, clean Vietnamese university style.
3. Improve responsive desktop and mobile layouts, loading states, empty states,
   API error states, buttons, icons, and subtle CSS transitions.
4. Do not change routes, API URLs, API response shapes, JWT handling, or the
   `accessToken` localStorage key.
5. Reuse Ant Design and `@ant-design/icons`; do not add another component or
   icon library.
6. Do not build a backend, mock API, Firebase integration, database, or login
   replacement.
7. Return the complete contents of each changed/new source file and explain
   where it belongs in the existing project.
8. Ensure the code is valid TypeScript and works with `npm run build`.

Start by reviewing the existing files. Improve the frontend without removing
any feature that currently exists.
