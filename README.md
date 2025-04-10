# Football Prediction Market

A web application for creating and trading on football prediction markets.

## Features

- User authentication and registration
- Admin dashboard for market management
- Create and manage prediction markets
- Trade on markets with virtual currency
- User profile with transaction history

## Tech Stack

- Next.js
- TypeScript
- Prisma
- SQLite
- Tailwind CSS
- Shadcn UI

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn

### Installation

1. Clone the repository
```bash
git clone https://github.com/yourusername/football-prediction-market.git
cd football-prediction-market
```

2. Install dependencies
```bash
npm install
# or
yarn install
```

3. Set up the database
```bash
npx prisma migrate dev
```

4. Create an admin user
```bash
node scripts/create-admin.js
```

5. Start the development server
```bash
npm run dev
# or
yarn dev
```

6. Open [http://localhost:3000](http://localhost:3000) in your browser

## Admin Credentials

- Email: admin@example.com
- Password: password123

## License

MIT
