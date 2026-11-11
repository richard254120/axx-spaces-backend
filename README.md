# AxxSpace Backend & AxxGo Classifieds

## Overview
AxxSpace is a Kenya property, accommodation, business directory, and classifieds platform.

---

## AxxGo — Instant Account-Free Classifieds

**AxxGo** (`/api/axxgo` on backend, `/axxgo` on frontend) is a public classifieds marketplace where anyone in Kenya can browse and post listings without creating an account.

### Key Rules & Behavior
1. **Instant Publishing (Zero Approval Step)**: Listings go `active` immediately upon submission.
2. **Account-Free Management**: When creating a listing, the poster receives a secure 32-byte hexadecimal `manageToken`. With this secret link (`/axxgo/manage/:token`), the poster can:
   - Edit their listing details, price, and category fields.
   - Update availability status: `active`, `sold`, `rented`, or `unavailable`.
   - Renew their listing for an additional 30 days.
   - Delete their listing permanently.
3. **Categories**:
   - **Rentals**: Property type, bedrooms, bathrooms, deposit, availability date.
   - **Accommodation**: Type (hostel, Airbnb, hotel, room), billing period (per night/month), amenities, capacity.
   - **AxxBiashara**: Business/service name, category/sector, opening hours, social/website links.
   - **Quick Sales**: Condition (new/used), brand, reason for selling.
4. **Safeguards & Security**:
   - **Rate Limiting**: Maximum 5 listings per hour per IP.
   - **Honeypot Field**: Hidden `website_hp` input traps automated spam bots.
   - **Anti-Bot Challenge**: Interactive math/bot verification challenge to prevent automated flooding.
   - **Image Validation & Optimization**: Supports JPG, PNG, and WebP (1 to 8 images, max 5MB each). Processed via **Sharp** to resize to max 1600px, compress to WebP, and strip all private EXIF / GPS metadata.
   - **Text Sanitization & Banned Words**: Prevents XSS, script injection, and blocks common upfront fee/scam phrases.
   - **Duplicate Detection**: Blocks duplicate posts with identical title and phone number within 10 minutes.
   - **Community Reports & Auto-Hiding**: Users can report listings (scam, wrong category, offensive, sold). If a listing reaches **3 or more reports**, it is automatically hidden from public search (`status: "hidden"`).
   - **30-Day Auto-Expiration**: Default `expiresAt` is set to 30 days from creation, with a self-service renew option.
   - **Safety Notice**: Prominent banner displayed across all listings: *"Never send money before seeing the item or property."*
5. **Admin Cleanup Console** (`GET /api/axxgo/admin/reports`):
   - Accessible only to authenticated administrators (`admin` role).
   - Review reported listings, inspect reports and reporter details.
   - Hide or unhide listings.
   - Permanently delete abusive listings.
   - Ban phone numbers and IP addresses.

---

## API Endpoints

### Public Classifieds
| Method | Route | Description |
|---|---|---|
| `GET` | `/api/axxgo/listings` | Search and browse classifieds (supports `category`, `county`, `area`, `minPrice`, `maxPrice`, `search`, `sort`, `page`, `limit`) |
| `GET` | `/api/axxgo/listings/:id` | View single listing details (increments views) |
| `POST` | `/api/axxgo/listings` | Post a listing (multipart form with `photos`, rate-limited to 5/hr) |
| `POST` | `/api/axxgo/listings/:id/report` | Report a listing (auto-hides on 3+ reports) |

### Account-Free Management
| Method | Route | Description |
|---|---|---|
| `GET` | `/api/axxgo/manage/:token` | Fetch listing details for management |
| `PUT` | `/api/axxgo/manage/:token` | Update listing or change status (`sold`, `rented`, `unavailable`, `active`) |
| `POST` | `/api/axxgo/manage/:token/renew` | Extend listing expiration by 30 days |
| `DELETE` | `/api/axxgo/manage/:token` | Permanently delete listing |

### Admin Moderation (`auth`, `adminOnly`)
| Method | Route | Description |
|---|---|---|
| `GET` | `/api/axxgo/admin/reports` | List all open and reviewed reports |
| `PUT` | `/api/axxgo/admin/reports/:id` | Update report status (`reviewed`, `actioned`, `dismissed`) |
| `POST` | `/api/axxgo/admin/listings/:id/hide` | Force hide or unhide a listing |
| `DELETE` | `/api/axxgo/admin/listings/:id` | Permanently remove listing and reports |
| `POST` | `/api/axxgo/admin/ban` | Ban a phone number or IP |
| `GET` | `/api/axxgo/admin/banned` | List banned entities |
| `DELETE` | `/api/axxgo/admin/banned/:id` | Remove ban |

---

## Environment Variables & Configuration

The following optional environment variables enhance AxxGo functionality:

| Variable | Description |
|---|---|
| `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name for cloud image hosting (falls back to local `/uploads/axxgo` if not configured) |
| `CLOUDINARY_API_KEY` | Cloudinary API Key |
| `CLOUDINARY_API_SECRET` | Cloudinary API Secret |
| `FRONTEND_URL` | Base URL of frontend (e.g. `https://axxspace.com` or `http://localhost:5173`) for secret management email links |
| `EMAIL_SERVICE` | `gmail` or custom SMTP service for sending management links |
| `EMAIL_USER` | Admin email address |
| `EMAIL_PASSWORD` | App password for SMTP service |
| `TURNSTILE_SECRET_KEY` | (Optional) Cloudflare Turnstile secret key if using Turnstile tokens |
| `RECAPTCHA_SECRET_KEY` | (Optional) Google reCAPTCHA secret key if using reCAPTCHA |

