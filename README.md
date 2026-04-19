This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

### Environment variables (Supabase)

Create a `.env.local` with:

```bash
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...   # server-side only (do NOT prefix with NEXT_PUBLIC)

# QR Beneficiary ID (server-side only)
QR_CARD_SECRET=...              # used to sign/verify beneficiary ID QR tokens
BENEFICIARY_SESSION_SECRET=...  # used for beneficiary session cookie (optional; falls back to QR_CARD_SECRET)
```

If deploying to Vercel, make sure `SUPABASE_SERVICE_ROLE_KEY` is configured in **Project Settings → Environment Variables**. Without it, creating admin/staff users will fail with “Admin client not available”.

### Database

To enable QR ID cards, run `setup-step5.sql` in the Supabase SQL Editor (creates `public.beneficiary_cards`).

### Supabase Storage (Valid ID uploads)

This app uploads beneficiary Valid IDs to Supabase Storage.

Create a Storage bucket named **`document`** in your Supabase project (Storage → Buckets → New bucket).

Admin/Staff view the uploaded ID through a signed URL (server-side) for verification.

First, run the development server (this repo enforces **pnpm**):

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.js`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
