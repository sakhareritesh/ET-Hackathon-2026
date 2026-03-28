import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: process.env.NODE_ENV === "production",
  serverExternalPackages: ["mongodb"],
};

export default nextConfig;
