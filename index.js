const Docker = require('dockerode');
const client = new Docker();
const every = require('p-every');

const interval = process.env.INTERVAL ? parseInt(process.env.INTERVAL, 10) : 1000 * 60 * 30;

const run = async function() {
  const services = await client.listServices({
    filters: {
      label: { autostop: true }
    }
  });

  const toStop = services.filter((s) => {
    const created = new Date(s.UpdatedAt);
    const stopAfterMin = parseInt(s.Spec.Labels.autostop, 10) * 1000 * 60;
    const now = new Date().getTime();
    if (created.getTime() + stopAfterMin < now) {
      return true;
    }
    return false;
  });

  await every(toStop, async (s) => {
    const service = await client.getService(s.ID);
    console.log(`Stopping ${s.Spec.Name}`);
    return await service.remove();
  });

  setInterval(run, interval);
};
run();
