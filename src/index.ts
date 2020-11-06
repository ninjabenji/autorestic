import 'colors'
import { program } from 'commander'

import { unlock, readLock, writeLock } from './lock'
import { Config } from './types'
import { init } from './config'

import info from './handlers/info'
import check from './handlers/check'
import backup from './handlers/backup'
import restore from './handlers/restore'
import forget from './handlers/forget'
import { cron } from './handlers/cron'
import exec from './handlers/exec'
import install from './handlers/install'
import { uninstall } from './handlers/uninstall'
import { upgrade } from './handlers/upgrade'

export const VERSION = '0.20'
export const INSTALL_DIR = '/usr/local/bin'

process.on('uncaughtException', (err) => {
  console.log(err.message)
  unlock()
  process.exit(1)
})

let queue: Function = () => {}
const enqueue = (fn: Function) => (cmd: any) => {
  queue = () => fn(cmd.opts())
}

program.storeOptionsAsProperties()
program.name('autorestic').version(VERSION)

program.option('-c, --config <path>', 'Config file').option('-v, --verbose', 'Verbosity', false)

program.command('info').action(enqueue(info))

program
  .command('check')
  .description('Checks and initializes backend as needed')
  .option('-b, --backend <backends...>')
  .option('-a, --all')
  .action(enqueue(check))

program.command('backup').description('Performs a backup').option('-b, --backend <backends...>').option('-a, --all').action(enqueue(backup))

program
  .command('restore')
  .description('Restores data to a specified folder from a location')
  .requiredOption('-l, --location <location>')
  .option('--from <backend>')
  .requiredOption('--to <path>', 'Path to save the restored data to')
  .action(enqueue(restore))

program
  .command('forget')
  .description('This will prune and remove data according to your policies')
  .option('-l, --location <locations...>')
  .option('-a, --all')
  .option('--dry-run')
  .action(enqueue(forget))

program
  .command('cron')
  .description('Intended to be triggered by an automated system like systemd or crontab.')
  .option('-a, --all')
  .action(enqueue(cron))

program
  .command('exec')
  .description('Run any native restic command on desired backends')
  .option('-b, --backend <backends...>')
  .option('-a, --all')
  .action(({ args, all, backend }) => {
    queue = () => exec({ all, backend }, args)
  })

program.command('install').description('Installs both restic and autorestic to /usr/local/bin').action(enqueue(install))

program.command('uninstall').description('Uninstalls autorestic from the system').action(enqueue(uninstall))

program.command('upgrade').alias('update').description('Checks and installs new autorestic versions').action(enqueue(upgrade))

const { verbose, config: configFile } = program.parse(process.argv)

export const VERBOSE = verbose
export let config: Config = init(configFile)

try {
  const lock = readLock()
  if (lock.running) throw new Error('An instance of autorestic is already running for this config file'.red)

  writeLock({
    ...lock,
    running: true,
  })
  queue()
} catch (e) {
  console.error(e.message)
} finally {
  unlock()
}
