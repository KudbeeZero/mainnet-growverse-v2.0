import { describe, it, expect, afterEach } from "vitest";
import nacl from "tweetnacl";
import { decodeAddress } from "algosdk";
import { connectWallet, disconnectWallet, signChallenge } from "@/lib/chain/algorand/wallet";

// The backend (services/wallet_auth.py) verifies a RAW (unprefixed) ed25519
// signature over the exact challenge message bytes -- matching what Pera's
// signData produces (see wallet.ts's doc comment). This asserts the dev
// signer produces a signature verifiable the same way, so both paths stay
// compatible with the one scheme the server checks.

describe("signChallenge (dev signer)", () => {
  afterEach(async () => {
    await disconnectWallet();
  });

  it("produces a raw ed25519 signature verifiable against the connected address", async () => {
    const { address } = await connectWallet("dev");
    const message = "GrowVerse wallet link\nPlayer: p1\nAddress: " + address + "\nNonce: abc123";

    const signatureB64 = await signChallenge(message);
    const signature = Uint8Array.from(Buffer.from(signatureB64, "base64"));
    const publicKey = decodeAddress(address).publicKey;

    expect(nacl.sign.detached.verify(new TextEncoder().encode(message), signature, publicKey)).toBe(true);
  });

  it("rejects a signature verified against a different message", async () => {
    const { address } = await connectWallet("dev");
    const signatureB64 = await signChallenge("original message");
    const signature = Uint8Array.from(Buffer.from(signatureB64, "base64"));
    const publicKey = decodeAddress(address).publicKey;

    expect(nacl.sign.detached.verify(new TextEncoder().encode("tampered message"), signature, publicKey)).toBe(
      false,
    );
  });

  it("throws if no wallet is connected", async () => {
    await expect(signChallenge("hello")).rejects.toThrow(/connect a wallet/i);
  });
});
