#!/bin/bash
PORT=3001

# Kill any existing process on the port
lsof -ti :$PORT | xargs kill -9 2>/dev/null

# Clear Next.js cache and start dev server
rm -rf .next
exec npx next dev -p $PORT
