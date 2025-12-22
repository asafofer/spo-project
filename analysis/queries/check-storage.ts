import { axiom } from "../src/axiom";

async function checkStorage() {
  try {
    // List all datasets
    const datasets = await axiom.datasets.list();

    if (!datasets || datasets.length === 0) {
      console.log("No datasets found.");
      return;
    }

    console.log(`Found ${datasets.length} dataset(s):\n`);

    let totalStorage = 0;
    let totalEvents = 0;

    for (const dataset of datasets) {
      const storageBytes = dataset.stats?.ingestedBytes || 0;
      const storageGB = storageBytes / (1024 * 1024 * 1024);
      const events = dataset.stats?.ingestedEvents || 0;

      totalStorage += storageBytes;
      totalEvents += events;

      console.log(`Dataset: ${dataset.name}`);
      console.log(`  ID: ${dataset.id}`);
      console.log(`  Storage: ${storageGB.toFixed(4)} GB (${storageBytes.toLocaleString()} bytes)`);
      console.log(`  Events: ${events.toLocaleString()}`);
      if (dataset.description) {
        console.log(`  Description: ${dataset.description}`);
      }
      console.log();
    }

    const totalStorageGB = totalStorage / (1024 * 1024 * 1024);
    console.log("---");
    console.log(`Total Storage: ${totalStorageGB.toFixed(4)} GB (${totalStorage.toLocaleString()} bytes)`);
    console.log(`Total Events: ${totalEvents.toLocaleString()}`);
  } catch (error: any) {
    console.error("Error checking storage:", error.message);
    if (error.response) {
      console.error("Response:", error.response.data);
    }
  }
}

checkStorage().catch(console.error);


