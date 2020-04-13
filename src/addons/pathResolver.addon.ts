// Include this file to get the PathResolver to set itself up
// this is exported from index
import PathResolver from '../PathResolver'

export default new PathResolver({ cwd: process.cwd() })
