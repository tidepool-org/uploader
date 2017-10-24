const fs = require('fs');
const readline = require('readline');
const program = require('commander');

program
  .version('0.0.1')
  .option('-f, --file [path]', 'console log file path')
  .parse(process.argv);

if (program.file && fs.existsSync(program.file)){
  console.log('Loading console log file...');
  let inputFile = fs.createReadStream(program.file);
  const rl = readline.createInterface({
     input: inputFile
  });

  let pages = [];

  rl.on('line', (input) => {
    if(input.indexOf('Reading CGM history') > 1) {
      // skip CGM history for now
      rl.close();
    }
    const pos = input.indexOf('| Page ');
    if ( pos > -1 ) {
      let bytes = [];
      const hexString = input.slice(input.indexOf(' ',pos+8)+1);
      for (var i = 0; i < hexString.length-1; i+=2) {
        bytes.push(parseInt(hexString.substr(i,2),16));
      }
      let arr = new Uint8Array(bytes.length);
      arr.set(bytes);

      pages.push({
        page: arr,
        nak: false,
        valid: true
      });
    }
  });

  rl.on('close', () => {
    console.log(JSON.stringify(pages, null, 4));
  });

}else{
  program.help();
}
