const pm2 = require('pm2');

pm2.connect((err) => {
    if (err) {
        logger.log('error', err);
    }
  
    pm2.start({
        name      : 'clipbrdsvc',
        script    : 'service.js',     // Script to be run
        output    : './out.log',
        error     : './error.log',
        exec_mode : 'cluster',        // Allows your app to be clustered
        instances : 1,                // Optional: Scales your app by 4
        max_memory_restart : '100M'   // Optional: Restarts your app if it reaches 100Mo
    }, (err, apps) => {
        pm2.disconnect();   // Disconnects from PM2
        if (err) throw err
    });
});