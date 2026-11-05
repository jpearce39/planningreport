# IT integration and hosting brief

## Purpose

This brief summarizes the current Planning Report Generator application stack and deployment for an in-house IT review. It also lists hosting and identity questions to resolve before planning a migration.

## Application and technology stack

| Area | Current implementation |
| --- | --- |
| Product | Browser-based Victorian residential planning report generator |
| Frontend | React 19, TypeScript, Vite 8 |
| Edge hosting and static assets | Cloudflare Workers; the Worker serves the built frontend and forwards `/api/*` requests |
| API | Node.js with Express 5 |
| Database | PostgreSQL, accessed by the API using the `pg` Node package |
| Report generation | Server-side Word document generation with Docxtemplater; Puppeteer and Chromium are used for browser rendering and planning-standard retrieval |
| Build and deployment | `npm run build` builds the frontend; `npm run deploy` deploys the Worker using Wrangler |

## Current deployment and access

The current deployment details below reflect the deployment information supplied for this review; confirm provider account, plan, and region details with the current administrators.

- **Frontend:** Deployed as a Cloudflare Worker, with Cloudflare Access in front of it.
- **Edge login:** Cloudflare Access uses one-time PINs sent to email and is intended to allow only `@wardledesign.com.au` addresses.
- **API:** Deployed to Render. The Cloudflare Worker forwards `/api` requests to `https://planning-report-api.onrender.com`.
- **Database:** PostgreSQL deployed to Render and connected to the API through `DATABASE_URL`.
- **Application login:** The application code also implements its own registration and email/password login, with 30-day server-side sessions in HTTP-only cookies. Passwords are salted and hashed with Node.js `scrypt`. This is separate from Cloudflare Access.
- **Application data:** User accounts, sessions, and projects are stored in PostgreSQL. Project report content and wizard progress are stored in the database; report content is stored as JSONB. The API also supports Word document generation.
- **External service dependencies:** Address and parcel lookup, planning zones and overlays, and satellite imagery use Esri/ArcGIS services. Automatic planning-standard retrieval reads the Victorian planning schemes website. Outbound HTTPS access to these services is needed for those features.
- **Configuration:** The API requires `DATABASE_URL`; production also uses `NODE_ENV=production` and `CORS_ORIGIN`. Render supplies the API `PORT`. The Worker configuration and API destination are in `wrangler.jsonc` and `worker.js`.

## Questions for IT

1. **Frontend/domain:** Can the built frontend be hosted on our existing webhosting and served under our current domain? If so, should it use a subdomain (for example, `tools.planning.wardledesign.com.au`) or a path on an existing site? Can IT provide DNS, TLS certificates, and any required reverse-proxy or static-site configuration?
2. **Cloudflare Access:** Can Cloudflare Access remain in front of the in-house-hosted frontend, with one-time PIN login restricted to `@wardledesign.com.au`? If not, what approved identity provider or access-control approach should replace it?
3. **API hosting:** Can the current webhosting run a persistent Node.js/Express API, or is a separate application-hosting service required? Does the hosting support the Node.js runtime and packages needed by the app?
4. **PostgreSQL:** Can the API use a PostgreSQL service on the current hosting platform, or does IT provide a managed PostgreSQL service? What are the connection, network allow-listing, backup, restore, and retention arrangements?
5. **Document generation:** Does the proposed API host support Puppeteer with Chromium, including the required executable and system libraries, memory, and temporary storage? These are used for document and planning-data processing.
6. **Networking:** Can the API make outbound HTTPS requests to the Esri/ArcGIS endpoints and the Victorian planning schemes website? Are there proxy, firewall, allow-listing, or data-egress requirements?
7. **Security and operations:** What are the requirements for secrets management, TLS, logging and monitoring, patching, incident response, database backups, and recovery testing?
8. **Migration:** Can IT support transferring existing PostgreSQL data from Render and validating it?

## Hosting considerations

- The frontend is a static Vite build in `dist`, so it can be served by a static web host if that host supports single-page application routing.
- The API is a separate Node.js service. Ordinary static hosting cannot run it; the target environment must provide an appropriate Node.js application runtime or an equivalent managed service.
- The app requires PostgreSQL connectivity from the API host. Database access should be private or restricted to the API host where the provider allows it.
- The current Worker is not just static hosting: it also proxies `/api/*` to a fixed Render API origin. A move should update or replace that routing and configure the API's allowed frontend origins (`CORS_ORIGIN`) consistently. Keeping Cloudflare Access while moving the origin may require updating its protected application and origin configuration.
- Before changing identity controls, confirm how Cloudflare Access interacts with the app's separate registration/password login, session cookies, and user-account lifecycle.
- Confirm with IT how report data, including any user-supplied images or map-related details, should be classified, retained, backed up, and migrated.

## Repository references

- `wrangler.jsonc` configures the Cloudflare Worker and serves the frontend build from `dist`.
- `worker.js` forwards API requests to the Render API origin.
- `server/index.js` implements the API, application authentication, external service integrations, and document generation.
- `server/database.js` defines the PostgreSQL connection and database schema initialization.
