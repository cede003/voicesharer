#!/bin/bash

echo "🚀 Setting up VoiceSharer with Supabase..."

# Check if .env.local exists
if [ ! -f ".env.local" ]; then
    echo "❌ .env.local not found!"
    exit 1
fi

echo "📝 Please update your .env.local file with your Supabase password:"
echo ""
echo "1. Go to your Supabase dashboard: https://supabase.com/dashboard"
echo "2. Select your project"
echo "3. Go to Settings → Database"
echo "4. Find your database password"
echo "5. Replace [YOUR-PASSWORD] in .env.local with your actual password"
echo ""
echo "Your connection string should look like:"
echo "DATABASE_URL=\"postgresql://postgres:your_actual_password@db.enrczjwazfcllczqlcuq.supabase.co:5432/postgres\""
echo ""
echo "Press Enter when you've updated the password..."
read

# Test database connection
echo "🔍 Testing database connection..."
if node test-db.js; then
    echo "✅ Database connection successful!"
    echo ""
    echo "🗄️ Setting up database schema..."
    if npx prisma db push; then
        echo "✅ Database schema created successfully!"
        echo ""
        echo "🎉 Setup complete! You can now run:"
        echo "   npm run dev"
    else
        echo "❌ Failed to create database schema"
        exit 1
    fi
else
    echo "❌ Database connection failed. Please check your password and try again."
    exit 1
fi
