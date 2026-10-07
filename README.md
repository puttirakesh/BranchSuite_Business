# BranchSuite Business - Simple Development Setup

Business app only.

## Stack
- Frontend: React Native + TypeScript + Expo
- Backend: NestJS + TypeScript
- Database: PostgreSQL + Prisma

## Main folders
- `frontend/` - Android/iOS mobile app
- `backend/` - REST API and database access
- `docs/` - project notes and developer split

## Start frontend
```bash
cd frontend
npm install
npx expo start
```

## Start backend
```bash
cd backend
npm install
cp .env.example .env
npx prisma generate
npx prisma migrate dev --name init
npm run start:dev
```

This starter intentionally contains only structure and small placeholder examples.
Build the remaining BranchSuite workflows inside these folders.
