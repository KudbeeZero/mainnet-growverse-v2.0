"""
Real Algorand provider (TestNet by default).

Talks to an Algod node via algosdk. The treasury account (creator/manager of the
ASA and NFTs) is loaded from a mnemonic supplied through a secret env var —
never stored in the DB or committed. All gameplay stays DB-authoritative; this
provider only materializes assets on-chain.

This class is exercised against live TestNet by an opt-in integration test; unit
tests use MockChainProvider so CI needs no network or funded account.
"""

from typing import Optional, Tuple

from .provider import ChainProvider, AssetInfo, AssetMint, ChainError, TREASURY

_CONFIRM_ROUNDS = 6


class AlgorandProvider(ChainProvider):
    def __init__(
        self,
        algod_url: str,
        algod_token: str,
        treasury_mnemonic: str,
        network_name: str = "testnet",
    ):
        # Imported lazily so the package works without algosdk installed.
        try:
            from algosdk.v2client import algod
            from algosdk import account, mnemonic
        except ImportError as exc:  # pragma: no cover
            raise ChainError("py-algorand-sdk is not installed") from exc

        if not treasury_mnemonic:
            raise ChainError("ALGO_TREASURY_MNEMONIC is required for on-chain mode")

        self._network = network_name
        self.client = algod.AlgodClient(algod_token, algod_url)
        self.treasury_sk = mnemonic.to_private_key(treasury_mnemonic)
        self.treasury_addr = account.address_from_private_key(self.treasury_sk)

    def network(self) -> str:
        return self._network

    def create_account(self) -> Tuple[str, str]:
        from algosdk import account, mnemonic

        sk, addr = account.generate_account()
        return addr, mnemonic.from_private_key(sk)

    def create_asset(
        self, *, unit_name, asset_name, total, decimals, url=None, metadata_hash=None
    ) -> int:
        return self._create_asset(
            unit_name=unit_name,
            asset_name=asset_name,
            total=total,
            decimals=decimals,
            url=url,
            metadata_hash=metadata_hash,
        )["asset-index"]

    def create_asset_tx(
        self, *, unit_name, asset_name, total, decimals, url=None, metadata_hash=None
    ) -> AssetMint:
        result = self._create_asset(
            unit_name=unit_name,
            asset_name=asset_name,
            total=total,
            decimals=decimals,
            url=url,
            metadata_hash=metadata_hash,
        )
        return AssetMint(asset_id=result["asset-index"], txid=result["txid"])

    def _create_asset(
        self, *, unit_name, asset_name, total, decimals, url=None, metadata_hash=None
    ) -> dict:
        from algosdk import transaction

        sp = self.client.suggested_params()
        txn = transaction.AssetCreateTxn(
            sender=self.treasury_addr,
            sp=sp,
            total=total,
            decimals=decimals,
            default_frozen=False,
            unit_name=unit_name,
            asset_name=asset_name,
            url=url,
            manager=self.treasury_addr,
            reserve=self.treasury_addr,
            metadata_hash=metadata_hash,
        )
        return self._send(txn)

    def destroy_asset(self, asset_id: int) -> str:
        from algosdk import transaction

        sp = self.client.suggested_params()
        txn = transaction.AssetDestroyTxn(
            sender=self.treasury_addr, sp=sp, index=asset_id
        )
        return self._send(txn)["txid"]

    def transfer_asset(self, asset_id, receiver, amount) -> str:
        from algosdk import transaction, account

        # Always the treasury key — see the ABC docstring for why this never
        # accepts a caller-supplied signer.
        sk = self.treasury_sk
        sender_addr = account.address_from_private_key(sk)
        # Resolve the TREASURY sentinel to the real treasury address so callers
        # can use the provider-agnostic constant without leaking it on-chain.
        if receiver == TREASURY:
            receiver = self.treasury_addr
        sp = self.client.suggested_params()
        txn = transaction.AssetTransferTxn(
            sender=sender_addr, sp=sp, receiver=receiver, amt=amount, index=asset_id
        )
        return self._send(txn, signer_sk=sk)["txid"]

    def asset_info(self, asset_id: int) -> AssetInfo:
        info = self.client.asset_info(asset_id)
        params = info["params"]
        return AssetInfo(
            asset_id=asset_id,
            name=params.get("name", ""),
            unit_name=params.get("unit-name", ""),
            total=params.get("total", 0),
            decimals=params.get("decimals", 0),
            url=params.get("url"),
        )

    # ----- internals ------------------------------------------------------
    def _send(self, txn, signer_sk: Optional[str] = None) -> dict:
        from algosdk import transaction

        signed = txn.sign(signer_sk or self.treasury_sk)
        txid = self.client.send_transaction(signed)
        result = transaction.wait_for_confirmation(self.client, txid, _CONFIRM_ROUNDS)
        result["txid"] = txid
        return result
