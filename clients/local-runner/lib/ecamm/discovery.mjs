/**
 * Bonjour/mDNS discovery for _ecammliveremote._tcp
 */

import { Bonjour } from "bonjour-service";
import {
  DISCOVERY_WINDOW_MS,
  ECAMM_SERVICE_PROTOCOL,
  ECAMM_SERVICE_TYPE,
} from "./constants.mjs";

function isIpv4(address) {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(address);
}

function stripTrailingDot(value) {
  return value.endsWith(".") ? value.slice(0, -1) : value;
}

function equalsIgnoringCase(a, b) {
  return b !== undefined && a.toLowerCase() === b.toLowerCase();
}

/**
 * @param {number} timeoutMs
 * @returns {Promise<Array<{name:string,hostname:string,addresses:string[],port:number,fqdn:string}>>}
 */
export async function discoverEcammInstances(timeoutMs = DISCOVERY_WINDOW_MS) {
  const bonjour = new Bonjour();
  const found = new Map();

  const browser = bonjour.find({ type: ECAMM_SERVICE_TYPE, protocol: ECAMM_SERVICE_PROTOCOL });
  browser.on("up", (service) => {
    const addresses = (service.addresses ?? []).filter(isIpv4);
    if (addresses.length === 0 || !service.port) return;
    const fqdn = service.fqdn || `${service.name}._${ECAMM_SERVICE_TYPE}._${ECAMM_SERVICE_PROTOCOL}.local`;
    found.set(fqdn, {
      name: service.name,
      hostname: stripTrailingDot(service.host ?? ""),
      addresses,
      port: service.port,
      fqdn,
    });
  });

  try {
    await new Promise((resolve) => setTimeout(resolve, timeoutMs));
  } finally {
    try {
      browser.stop();
    } catch {
      /* ignore */
    }
    try {
      bonjour.destroy();
    } catch {
      /* ignore */
    }
  }

  return [...found.values()];
}

/**
 * Hostname wins. Never silently match a different Mac.
 */
export function matchInstance(found, want) {
  if (want?.hostname) {
    const byHostname = found.find((item) => equalsIgnoringCase(item.hostname, want.hostname));
    if (byHostname) return byHostname;
  }
  if (want?.address) {
    return found.find((item) => item.addresses.includes(want.address));
  }
  return undefined;
}

export function splitHost(hostAndPort) {
  if (!hostAndPort) return { address: "", port: undefined };
  const index = hostAndPort.lastIndexOf(":");
  if (index === -1) return { address: hostAndPort, port: undefined };
  const port = Number(hostAndPort.slice(index + 1));
  return { address: hostAndPort.slice(0, index), port: Number.isFinite(port) ? port : undefined };
}

export function pickHostAddress(instance, preferredAddress) {
  if (preferredAddress && instance.addresses.includes(preferredAddress)) return preferredAddress;
  return instance.addresses[0];
}
