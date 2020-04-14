import PathResolver, { IPathResolverOptions } from './PathResolver'
import log from './lib/log'
export default PathResolver
export function register(options: IPathResolverOptions) {
	log.info(`Registered PathResolver with cwd ${options.tsConfigDir}`)
	new PathResolver(options)
}
