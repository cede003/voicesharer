#!/bin/bash

echo "🎙️ Setting up VoiceSharer..."

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Generate Prisma client
echo "🗄️ Generating Prisma client..."
npx prisma generate

# Check if .env.local exists
if [ ! -f ".env.local" ]; then
    echo "⚠️  .env.local not found!"
    echo "Please create .env.local with your database configuration."
    echo "See POSTGRES_SETUP.md for detailed instructions."
    echo ""
    echo "Quick options:"
    echo "1. Supabase (recommended): https://supabase.com"
    echo "2. Railway: https://railway.app"
    echo "3. Neon: https://neon.tech"
    echo "4. Local PostgreSQL"
    exit 1
fi

# Check if database is accessible
echo "🔍 Checking database connection..."
if npx prisma db push --accept-data-loss 2>/dev/null; then
    echo "✅ Database connection successful!"
else
    echo "❌ Database connection failed!"
    echo "Please check your DATABASE_URL in .env.local"
    exit 1
fi

# Create uploads directory
echo "📁 Creating uploads directory..."
mkdir -p uploads

echo "🎉 Setup complete!"
echo ""
echo "To start the development server:"
echo "  npm run dev"
echo ""
echo "To view the database:"
echo "  npm run db:studio"
