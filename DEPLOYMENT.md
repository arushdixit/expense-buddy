# 🚀 Deploying Expense Buddy to Vercel + Supabase

This guide walks you through deploying your expense tracking PWA for **free** using:
- **Supabase** - PostgreSQL database (500 MB free)
- **Vercel** - Frontend hosting (unlimited free for hobby projects)

---

## 📋 Prerequisites

- GitHub account (to connect to Vercel)
- Your project pushed to a GitHub repository

---

## Step 1: Set Up Supabase

### 1.1 Create a Supabase Account

1. Go to [supabase.com](https://supabase.com)
2. Click "Start your project" and sign in with GitHub
3. Click "New project"
4. Fill in:
   - **Organization**: Create one or use existing
   - **Project name**: `expense-buddy` (or any name)
   - **Database password**: Generate a strong password (save this!)
   - **Region**: Choose the closest to you (e.g., `Singapore` for UAE)
5. Click "Create new project" and wait ~2 minutes

### 1.2 Create Database Tables

1. In your Supabase project dashboard, click **SQL Editor** (left sidebar)
2. Click **New query**
3. Copy and paste the entire contents of `supabase-schema.sql` from this project
4. Click **Run** (or press Cmd+Enter)
5. You should see "Success. No rows returned" - this means tables were created!

### 1.3 Get Your API Keys

1. Go to **Settings** (gear icon, bottom left)
2. Click **API** in the sidebar
3. Copy these values (you'll need them for Vercel):
   - **Project URL** (e.g., `https://abcdefgh.supabase.co`)
   - **anon public** key (the long JWT token)
   - **service_role** key (for migration only - keep this secret!)

---

## Step 2: Migrate Your Existing Data

### 2.1 Export from SQLite (already done)

The export was created at `/tmp/expenses_data.json`. If you need to re-export:

```bash
cd /path/to/expense-buddy
sqlite3 server/expenses.db "SELECT json_group_array(json_object('id', id, 'amount', amount, 'category', category, 'subcategory', subcategory, 'date', date, 'note', note, 'created_at', created_at, 'updated_at', updated_at)) FROM expenses;" > /tmp/expenses_data.json
```

### 2.2 Run the Migration Script

```bash
cd /path/to/expense-buddy

SUPABASE_URL=https://your-project-id.supabase.co \
SUPABASE_SERVICE_KEY=your-service-role-key \
npx tsx scripts/migrate-to-supabase.ts
```

You should see output like:
```
🚀 Starting migration to Supabase...
📦 Found 215 expenses to migrate
✅ Inserted batch 1 (100/215)
✅ Inserted batch 2 (200/215)
✅ Inserted batch 3 (215/215)
✨ Migration complete!
```

### 2.3 Verify Migration

Go to your Supabase dashboard > **Table Editor** > Select `expenses` table.
You should see all your expenses!

---

## Step 3: Deploy to Vercel

### 3.1 Push to GitHub

If not already done:

```bash
git add .
git commit -m "feat: add Supabase integration for Vercel deployment"
git push origin feature/vercel-supabase-deployment
```

Then create a Pull Request and merge to `main`.

### 3.2 Connect to Vercel

1. Go to [vercel.com](https://vercel.com)
2. Click "Sign up" with GitHub
3. Click "Add New Project"
4. Select your `expense-buddy` repository
5. Configure the project:
   - **Framework Preset**: Vite (should auto-detect)
   - **Root Directory**: `./` (leave default)
   - **Build Command**: `npm run build` (leave default)
   - **Output Directory**: `dist` (leave default)

### 3.3 Add Environment Variables

In the Vercel project settings, add these environment variables:

| Name                     | Value                                 |
| ------------------------ | ------------------------------------- |
| `VITE_SUPABASE_URL`      | `https://your-project-id.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Your anon/public key from Supabase    |

Click **Deploy**!

---

## Step 4: Configure Your Domain (Optional)

1. In Vercel, go to your project > **Settings** > **Domains**
2. Add your custom domain or use the free `.vercel.app` subdomain
3. Update your PWA manifest if using a custom domain

---

## Step 5: Verify Deployment

1. Visit your Vercel URL (e.g., `expense-buddy.vercel.app`)
2. The app should load and display your expenses
3. Try adding a new expense - it should save to Supabase
4. Open browser DevTools > Console to check for any errors

---

## 🔒 Security Notes

1. **Row Level Security (RLS)** is enabled on all tables with public access
2. For a multi-user app, you'd want to:
   - Enable Supabase Auth
   - Add user_id column to expenses
   - Update RLS policies to filter by authenticated user

---

## 🆘 Troubleshooting

### "Failed to fetch expenses"

- Check that environment variables are set correctly in Vercel
- Ensure the Supabase project is not paused (free tier pauses after 7 days of inactivity)
- Check browser console for CORS errors

### Supabase project paused

Free tier projects pause after 7 days of inactivity. To resume:
1. Go to Supabase dashboard
2. Click "Restore project"
3. Wait ~2 minutes

### PWA not working offline

- The PWA caches the app shell but not the data
- For offline data access, the app uses IndexedDB (Dexie) locally
- Full sync happens when you're back online

---

## 📊 Free Tier Limits

| Service      | Free Limit                                              |
| ------------ | ------------------------------------------------------- |
| **Supabase** | 500 MB database, 2 GB bandwidth, unlimited API requests |
| **Vercel**   | Unlimited deployments, 100 GB bandwidth                 |

These limits are more than enough for personal expense tracking!

---

## 🎉 Done!

Your expense tracker is now live and free! 

- **Frontend**: Hosted on Vercel's global CDN
- **Database**: Managed PostgreSQL on Supabase
- **PWA**: Installable on any device
- **Cost**: $0/month

Remember to check your Supabase project occasionally to prevent pausing!
