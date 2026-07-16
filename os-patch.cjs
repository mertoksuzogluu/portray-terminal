// Preload patch: some sandboxed/macOS environments throw
// "uv_interface_addresses returned Unknown system error 1" when Node tries to
// enumerate network interfaces. Next.js calls os.networkInterfaces() while
// starting the dev/prod server to print the LAN URL, which crashes the listen
// handler. We wrap it to degrade gracefully to loopback only.
const os = require("os");
const original = os.networkInterfaces;

os.networkInterfaces = function patchedNetworkInterfaces() {
  try {
    return original.call(os);
  } catch {
    return {
      lo0: [
        {
          address: "127.0.0.1",
          netmask: "255.0.0.0",
          family: "IPv4",
          mac: "00:00:00:00:00:00",
          internal: true,
          cidr: "127.0.0.1/8",
        },
      ],
    };
  }
};
