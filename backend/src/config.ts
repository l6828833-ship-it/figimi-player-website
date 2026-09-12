import "node:process";

const required = (name: string): string => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
};

export const config = {
  port: Number(process.env.PORT || 8080),
  corsOrigins: (process.env.CORS_ORIGINS || "http://localhost:3000,http://127.0.0.1:3000")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean),
  supabaseUrl: () => required("SUPABASE_URL"),
  serviceRoleKey: () => required("SUPABASE_SERVICE_ROLE_KEY"),
  anonKey: () => required("SUPABASE_ANON_KEY"),
  credentialsKey: () => required("IPTV_CREDENTIALS_KEY"),
  /**
   * Shared with the Android TV app, which derives the same device key from its MAC.
   * The default only exists so local development works without extra setup; set an
   * explicit value in production and keep it identical to the Android constant.
   */
  deviceKeySecret: () => process.env.FIGIMI_DEVICE_KEY_SECRET?.trim() || "figimi-device-key-v1-shared-secret",
  usesDefaultDeviceKeySecret: () => !process.env.FIGIMI_DEVICE_KEY_SECRET?.trim(),
};
