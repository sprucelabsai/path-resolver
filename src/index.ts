import PathResolver, { IPathResolverOptions } from './PathResolver'
export default PathResolver
export function register(options?: IPathResolverOptions) {
	return PathResolver.getInstance(options)
}
