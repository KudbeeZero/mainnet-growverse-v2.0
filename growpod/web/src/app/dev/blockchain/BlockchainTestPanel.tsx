"use client";

import { useState } from "react";
import { isFaucetAvailable, requestTestnetAlgo } from "@/lib/chain/algorand/devFaucet";
import { getAlgodClient, algoNetwork } from "@/lib/chain/algorand/client";
import styles from "./BlockchainTestPanel.module.css";

interface TestResult {
  id: string;
  name: string;
  status: "idle" | "running" | "success" | "error";
  message: string;
  timestamp: number;
}

export function BlockchainTestPanel() {
  const [results, setResults] = useState<TestResult[]>([]);
  const [walletAddress, setWalletAddress] = useState("");
  const [faucetAmount, setFaucetAmount] = useState("10000000");
  const [isRunning, setIsRunning] = useState(false);

  const addResult = (
    name: string,
    status: "success" | "error",
    message: string,
  ) => {
    const result: TestResult = {
      id: `${Date.now()}-${Math.random()}`,
      name,
      status,
      message,
      timestamp: Date.now(),
    };
    setResults((prev) => [result, ...prev]);
  };

  const testAlgorandConnection = async () => {
    setIsRunning(true);
    try {
      const algod = getAlgodClient();
      const status = await algod.status().do();
      const network = algoNetwork();
      addResult(
        "Algorand Connection",
        "success",
        `Connected to ${network} | Round: ${status.lastRound}`,
      );
    } catch (e) {
      addResult(
        "Algorand Connection",
        "error",
        `Failed to connect: ${e instanceof Error ? e.message : String(e)}`,
      );
    } finally {
      setIsRunning(false);
    }
  };

  const testFaucetAvailability = async () => {
    setIsRunning(true);
    try {
      const available = isFaucetAvailable();
      const network = algoNetwork();
      if (available) {
        addResult(
          "Faucet Availability",
          "success",
          `Faucet is available on ${network} in development mode`,
        );
      } else {
        addResult(
          "Faucet Availability",
          "error",
          `Faucet is NOT available (network: ${network}, env: ${process.env.NODE_ENV})`,
        );
      }
    } catch (e) {
      addResult(
        "Faucet Availability",
        "error",
        `Error checking faucet: ${e instanceof Error ? e.message : String(e)}`,
      );
    } finally {
      setIsRunning(false);
    }
  };

  const testFaucetRequest = async () => {
    if (!walletAddress.trim()) {
      addResult(
        "Faucet Request",
        "error",
        "Please enter a wallet address",
      );
      return;
    }

    setIsRunning(true);
    try {
      const amount = parseInt(faucetAmount, 10);
      if (isNaN(amount) || amount <= 0) {
        throw new Error("Invalid amount: must be a positive integer");
      }

      const result = await requestTestnetAlgo(walletAddress, amount);
      addResult(
        "Faucet Request",
        "success",
        `Requested ${amount} microAlgo | Tx ID: ${result.txId}`,
      );
    } catch (e) {
      addResult(
        "Faucet Request",
        "error",
        `Faucet request failed: ${e instanceof Error ? e.message : String(e)}`,
      );
    } finally {
      setIsRunning(false);
    }
  };

  const testAccountInfo = async () => {
    if (!walletAddress.trim()) {
      addResult(
        "Account Info",
        "error",
        "Please enter a wallet address",
      );
      return;
    }

    setIsRunning(true);
    try {
      const algod = getAlgodClient();
      const accountInfo = await algod.accountInformation(walletAddress).do();
      addResult(
        "Account Info",
        "success",
        `Balance: ${accountInfo.amount} microAlgo | Assets: ${accountInfo.assets?.length ?? 0}`,
      );
    } catch (e) {
      addResult(
        "Account Info",
        "error",
        `Failed to fetch account info: ${e instanceof Error ? e.message : String(e)}`,
      );
    } finally {
      setIsRunning(false);
    }
  };

  const clearResults = () => {
    setResults([]);
  };

  return (
    <div className={styles.container}>
      <h1>Blockchain Testing Console</h1>

      <section className={styles.section}>
        <h2>Connection Tests</h2>
        <div className={styles.buttonGroup}>
          <button
            onClick={testAlgorandConnection}
            disabled={isRunning}
            className={styles.button}
          >
            Test Algorand Connection
          </button>
          <button
            onClick={testFaucetAvailability}
            disabled={isRunning}
            className={styles.button}
          >
            Check Faucet Availability
          </button>
        </div>
      </section>

      <section className={styles.section}>
        <h2>Wallet & Account Tests</h2>
        <div className={styles.inputGroup}>
          <label htmlFor="wallet-address">Wallet Address:</label>
          <input
            id="wallet-address"
            type="text"
            value={walletAddress}
            onChange={(e) => setWalletAddress(e.target.value)}
            placeholder="Enter Algorand wallet address (AXXXXXX...)"
            className={styles.input}
          />
        </div>

        <div className={styles.buttonGroup}>
          <button
            onClick={testAccountInfo}
            disabled={isRunning || !walletAddress.trim()}
            className={styles.button}
          >
            Get Account Info
          </button>
        </div>
      </section>

      <section className={styles.section}>
        <h2>Faucet Tests (TestNet Only)</h2>
        <div className={styles.inputGroup}>
          <label htmlFor="faucet-amount">Amount (microAlgo):</label>
          <input
            id="faucet-amount"
            type="number"
            value={faucetAmount}
            onChange={(e) => setFaucetAmount(e.target.value)}
            placeholder="10000000"
            className={styles.input}
          />
          <small>Default: 10,000,000 (10 ALGO)</small>
        </div>

        <div className={styles.buttonGroup}>
          <button
            onClick={testFaucetRequest}
            disabled={isRunning || !walletAddress.trim()}
            className={styles.button}
          >
            Request TestNet ALGO
          </button>
        </div>
      </section>

      <section className={styles.section}>
        <h2>Test Results</h2>
        <div className={styles.controls}>
          <button
            onClick={clearResults}
            className={styles.clearButton}
          >
            Clear Results
          </button>
          <span className={styles.resultCount}>
            {results.length} test(s)
          </span>
        </div>

        <div className={styles.resultsList}>
          {results.length === 0 ? (
            <p className={styles.empty}>No results yet. Run a test above.</p>
          ) : (
            results.map((result) => (
              <div
                key={result.id}
                className={`${styles.result} ${styles[`result-${result.status}`]}`}
              >
                <div className={styles.resultHeader}>
                  <strong>{result.name}</strong>
                  <span className={styles.resultStatus}>
                    {result.status === "success" ? "✓" : "✗"}
                  </span>
                </div>
                <p className={styles.resultMessage}>{result.message}</p>
                <small className={styles.resultTime}>
                  {new Date(result.timestamp).toLocaleTimeString()}
                </small>
              </div>
            ))
          )}
        </div>
      </section>

      <section className={styles.info}>
        <h3>Environment Info</h3>
        <ul>
          <li>Network: <code>{algoNetwork()}</code></li>
          <li>Environment: <code>{process.env.NODE_ENV}</code></li>
          <li>Faucet Available: <code>{isFaucetAvailable() ? "Yes" : "No"}</code></li>
        </ul>
      </section>
    </div>
  );
}
