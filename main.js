var Node = require('./node');
var async = require('async');
var Flags = require('commander');
var colors = require('colors');

colors.setTheme({
    command: 'red',
    Aaccept: 'grey',
    Sslot: 'yellow',
    Ffork: 'blue',
    Pprepare: 'magenta',
    Ccommit: 'green',

});

var nodes = [];

function main() {
  Flags
    .version(require('./package').version)
    .option('-b, --bad-ids [value]', 'Specify bad node id list, for example: 1,2,3')
    .option('-p, --pbft', 'Enable pbft algorithms')
    .parse(process.argv);
  global.Flags = Flags;
  var badIds = [];
  if (Flags.badIds) {
    badIds = Flags.badIds.split(',').map(function(e) {
      return Number(e);
    });
  }
  Flags.badIds = badIds;
  Flags.pbft = !!Flags.pbft;

  async.series([
    function(next) {
      console.log('step 1 init nodes ...'.command);
      for (var i = 0; i < 20; i++) {
        nodes[i] = new Node(i, badIds.indexOf(i) !== -1);
      }
      setTimeout(next, 1000);
    },
    function(next) {
      console.log('step 2 init p2p network ...'.command);
      for (var i in nodes) {
        nodes[i].connect();
      }
      setTimeout(next, 2000);
    },
    function(next) {
      console.log('step 3 start forging'.command);
      for (var i in nodes) {
        nodes[i].start();
      }
      next();
    }
  ], function(err, results) {
    setInterval(function() {
      nodes.forEach(function(node) {
        node.printBlockChain();
      });
    }, 5000);
  });
}

main();
