
// NOTE readAs can be 'readAsArrayBuffer', 'readAsBinaryString', 'readAsDataURL' or 'readAsText'

const fileReader = (file, readOptions, done) => {

	const { readAs, onProgress } = readOptions

	const reader = new FileReader()

	reader.onerror = event => {
		done(event)
	}

	reader.onprogress = event => {
		console.info('use this to measure and display progress', event.loaded)
		if(onProgress) onProgress(event)
	}

	reader.onloadend = event => {
		console.info('use this to measure total bytes received', event.total)
		console.log('EVENT', event)
		done(null, event.target.result)
	}

	reader[readAs](file)
}

export default fileReader
