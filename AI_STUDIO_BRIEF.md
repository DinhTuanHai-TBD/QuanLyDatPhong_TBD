# QuanLyDatPhong_TBD frontend brief

## Stack that must remain

- React 19, TypeScript, Vite
- Ant Design and Ant Design icons
- React Router
- Axios and TanStack Query

## Existing routes

- `/` home page
- `/login` login and registration
- `/rooms` room information
- `/bookings` create a booking request
- `/booking-history` booking history for the current user

## API contract that must not change

- `POST /api/auth/login`
- `POST /api/auth/register`
- `GET /api/rooms`
- `POST /api/bookings`
- `GET /api/bookings/mine`

The Axios client is `src/api/http.ts`. It reads the backend URL from
`VITE_API_URL` and attaches the JWT access token from localStorage.

## Important constraints

- Do not create or change any backend code.
- Do not change API paths, response fields, localStorage key `accessToken`,
  or the `VITE_API_URL` environment variable.
- Keep booking creation and booking history as two separate pages.
- Reuse images in `public/images` and Ant Design icons.
- Do not add another UI library.
- Do not include passwords, API keys, database credentials, JWT tokens, or
  `.env` files in generated code.

## Integration request

Return only changed or newly created frontend source files. Keep the current
folder structure and TypeScript types. The result must pass `npm run build`.
