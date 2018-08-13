const Docker = require('dockerode');
const client = new Docker();
const every = require('p-every');

const interval = process.env.INTERVAL ? parseInt(process.env.INTERVAL, 10) : 1000 * 60 * 10;
const removeStack = (process.env.REMOVE_STACK === 'true');

const run = async function() {
  const services = await client.listServices();
  const stackServices = (stack) => services.filter((s) => (s.Spec.Labels && s.Spec.Labels['com.docker.stack.namespace'] === stack));

  const toStop = services.filter((s) => {
    const created = new Date(s.UpdatedAt);
    const stopDelay = (s.Spec.Labels && s.Spec.Labels.autostop) ? parseInt(s.Spec.Labels.autostop, 10) : -1;
    if (stopDelay === -1 || stopDelay === 0) {
      return false;
    }
    const stopAfterMin = stopDelay * 1000 * 60;
    const now = new Date().getTime();
    if (created.getTime() + stopAfterMin < now) {
      return true;
    }
    return false;
  });

  console.log(`Found ${toStop.length} services ready to stop`);

  every(toStop, async (s) => {
    const service = await client.getService(s.ID);
    console.log(`Stopping ${s.Spec.Name}`);
    if (removeStack && s.Spec.Labels && s.Spec.Labels['com.docker.stack.namespace']) {
      const stackName = s.Spec.Labels['com.docker.stack.namespace'];
      const stackServs = stackServices(stackName);
      every(stackServs, async (srv) => {
        console.log(`Removing stack service ${stackName}:${srv.Spec.Name}`);
        const srvObject = await client.getService(srv.ID);
        return await srvObject.remove();
      });
      return;
    }
    return await service.remove();
  });

  console.log('Complete');

  setTimeout(run, interval);
};
run();
