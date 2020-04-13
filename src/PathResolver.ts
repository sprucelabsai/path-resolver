import coreModuleLoader = require('module')
import path = require('path')
import fs from 'fs'

export interface IPathResolverOptions {
	cwd: string
}

/** Enable paths support from compiler options of the tsconfig */
export default class PathResolver {
	public compilerOptions: Record<string, any>
	public replacePaths: Record<string, string[]> = {}
	public pathCache: Record<string, string> = {}

	public constructor(options: IPathResolverOptions) {
		const { cwd } = options
		this.compilerOptions = require(`${cwd}/tsconfig.json`).compilerOptions

		// Setup all replace paths based on compiler options
		Object.keys(this.compilerOptions.paths).forEach(alias => {
			this.replacePaths[
				alias.replace(/\*.?/, '(.*)')
			] = this.compilerOptions.paths[alias].map((destination: string) =>
				destination.replace(/\*.?/, '$1')
			)
		})

		// Store original resolveFilename from core module loader to be called after the we do the mapping below
		//@ts-ignore
		coreModuleLoader._originalResolveFilename =
			//@ts-ignore
			coreModuleLoader._resolveFilename

		// Override _resolveFilename to do our mapping based on tsconfig
		//@ts-ignore
		coreModuleLoader._resolveFilename = (
			request: string,
			parent: coreModuleLoader,
			isMain: boolean
		) => {
			const resolved = this.resolvePath(request)

			// @ts-ignore
			return coreModuleLoader._originalResolveFilename(resolved, parent, isMain)
		}
	}

	/** Pass a path and i'll lookup places to find it based on your tsconfig */
	public resolvePath(request: string): string {
		// If already found, return now
		if (this.pathCache[request]) {
			return this.pathCache[request]
		}

		let foundMatch = false
		const attemptedPaths: string[] = []
		const pathPatterns = Object.keys(this.replacePaths)
		for (const pattern of pathPatterns) {
			// Does the requested match our patterns?
			const regex = new RegExp(pattern)
			if (request.match(regex)) {
				// Check each path to find one that exists
				for (const candidatePath of this.replacePaths[pattern]) {
					let fullPath: string | undefined
					if (candidatePath.search('node_modules') > -1) {
						fullPath = path.join(
							__dirname,
							'..',
							'..',
							request.replace(regex, candidatePath)
						)
					} else {
						fullPath = path.join(
							__dirname,
							'..',
							'..',
							this.compilerOptions.outDir,
							request.replace(regex, candidatePath)
						)
					}

					// Does this candidate exist? if so, mutate the request so core loads it correctly
					foundMatch = true
					attemptedPaths.push(fullPath + '.js')
					if (fs.existsSync(fullPath + '.js')) {
						this.pathCache[request] = fullPath
						return fullPath
					}
				}
			}
		}

		if (foundMatch) {
			throw new Error(
				`Could not resolve ${request}, tried: \n\n ${attemptedPaths.join('\n')}`
			)
		}

		// It did not match any of our patterns, so pass it back as is
		this.pathCache[request] = request

		return request
	}
}