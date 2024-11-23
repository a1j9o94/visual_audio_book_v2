/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */
import "./src/env.js";

/** @type {import("next").NextConfig} */
const config = {
    images: {
        remotePatterns: [
            { hostname: "www.gutenberg.org" },
            { hostname: "covers.openlibrary.org" },
            { hostname: "utfs.io" },
            { hostname: "localhost" },
            { hostname: "railway.app" },
            { hostname: "bucket-production-a14d.up.railway.app" },
        ],
    },
};

export default config;
