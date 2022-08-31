
class SeaweedUploader {
    filerIp: string
    folderName: string
    token: string
    maxMB: number
    chunkInBytes: number

    constructor(FilerIp: string, FolderName: string, JWT: string, ChunkSize: number) {
        this.filerIp = FilerIp
        this.folderName = FolderName
        this.token = JWT
        this.maxMB = ChunkSize
        this.chunkInBytes = 1024 * 1024 * this.maxMB
    }

    async HandleFile(file: File, name: string, onProgress: (progress: number) => void, fileOffset: number) {
        let response
        // If file is less than 2 chunk sizes, don't chunk it
        if (file.size < ((this.maxMB * 2) * (1024 * 1024))) {
            response = await this.UploadFile(file, name)
            return response
        }
        var blob: Blob = new Blob()
        let offset: number = fileOffset
        let chunkNumber: number = 1
        let readError: number = 0
        let bytesRemaining: number = file.size - offset
        while (true) {  // while cancellation is not requested in the future
            if (bytesRemaining > 0) {
                let size: number = Math.min(bytesRemaining, this.chunkInBytes)
                let readPosition: number = file.size - bytesRemaining
                try {
                    blob = file.slice(offset, offset + size)
                }
                catch (error) {
                    readError++;
                    if (readError >= 3) {
                        console.log("Error reading from file")
                        break
                    }
                }
                if (blob.size === 0) {
                    // Nothing was read
                    break
                }
                // Next time start where we ended this time
                offset += blob.size
                console.log("Offset:")
                console.log(offset)
                console.log("Blob size:")
                console.log(blob.size)
                // Remaining bytes decrease by the amount we read
                bytesRemaining -= blob.size
            }
            if (offset != 0) {
                // Chris from Seaweed recommends retries for file uploads to the filer
                // https://github.com/seaweedfs/seaweedfs/wiki/Filer-Server-API#notice
                let retryCount: number = 0
                while (retryCount < 6) {
                    response = await this.UploadChunk(blob, name)
                    console.log("Response")
                    console.log(response)
                    if (response === -1) {
                        // File not uploaded
                        console.log("Error uploading file")
                        if (retryCount === 5) {
                            console.log("File upload failed")
                            break
                        }
                    }
                    if (response !== 0) {
                        // Update progress?
                        break
                    }
                    else {
                        retryCount++
                    }
                }
                chunkNumber++
                if (bytesRemaining == 0)
                {
                    //Success
                    break;
                }
            }
        }
        // From C# code
        /*
        if (cancellationToken.IsCancellationRequested == true) {
            response.name = "paused";
        }
        */
        return response
    }

    async UploadFile(file: File, fileName: string) {
        var response: number = -1
        try {
            let url = this.filerIp + "/" + this.folderName + "?maxMB=" + this.maxMB.toString()
            let formData = new FormData()
            formData.append(fileName, file)
            let request = await fetch(url, {
                method: 'POST',
                body: formData // body data type must match "Content-Type" header
            })
            // 404 means no file exists with that filename
            if (request.status != 404) {
                // Wait for result of Promise
                let x = await request.json()
                // See if there is data
                if (x != undefined || x != null) {
                    // Set response to size of file
                    response = x.size
                }
            }
        }
        catch (error) {
            console.log(error)
        }
        return response
    }

    async UploadChunk(blob: Blob, fileName: string) {
        var response: number = -1
        try {
            let url = this.filerIp + "/" + this.folderName + "/" + fileName + "?op=append&maxMB=" + this.maxMB.toString()
            let formData = new FormData()
            formData.append(fileName, blob)
            let responseJSON
            let request = await fetch(url, {
                method: 'POST',
                body: formData // body data type must match "Content-Type" header
            })
            // 404 means no file exists with that filename
            if (request.status != 404) {
                // Wait for result of Promise
                let x = await request.json()
                // See if there is data
                if (x != undefined || x != null) {
                    // Set response to size of file
                    response = x.size
                }
            }
        }
        catch (error) {
            console.log(error)
        }
        return response
    }

    async GetFileMetadata(fileName: string) {
        var xhr = new XMLHttpRequest()
        let url = this.filerIp + "/" + this.folderName + "/" + fileName + "?metadata=true&pretty=yes"
        // Unless response is good, return -1
        var response: number = -1
        var x = await fetch(url)
        // If 404 no file exists with that name
        if (x.status != 404) {
            // Convert response to json
            let y = await x.json()
            // Check if there is a value
            if (y != undefined || y != null) {
                // Return value
                response = await y.FileSize
            }
        }
        return response
    }

    //return a json format subdirectory and files listing
    //GET /path/to/
    //Accept: application/json
    async FindFolder() {
        var xhr = new XMLHttpRequest()
        let url = this.filerIp + "/" + this.folderName + "?pretty=y"
        // Unless response is good, return -1
        var response: number = -1
        var x = await fetch(url, {headers: {'Accept': 'application/json'}})
        // If 404 no file exists with that name
        if (x.status != 404) {
            // Convert response to json
            let y = await x.json()
            // Check if there is a value
            if (y != undefined || y != null) {
                console.log(y.Path)
                // Return value
                response = 0
            }
        }
        return response
    }

    async CreateFolder() {
        var xhr = new XMLHttpRequest()
        let url = this.filerIp + "/" + this.folderName + "/"
        // Unless response is good, return -1
        var response: number = -1
        var x = await fetch(url, {method: 'POST', headers: {'Accept': 'application/json'}})
        // If 404 no file exists with that name
        if (x.status != 404) {
            // Convert response to json
            let y = await x.json()
            // Check if there is a value
            if (y != undefined || y != null) {
                console.log(y)
                // Return value
                response = 0
            }
        }
        return response
    }
}

// Placeholder
let uploadFileData = {
    progress: 0
}
// CORS error will be thrown if the request is not sent to a proxy which modifies the origin header
// Koa proxy 
// https://www.npmjs.com/package/koa-proxy
// npm install koa
// npm install @koa/cors
// npm install koa-proxies

let filerIp = "http://localhost:8889"
let folderName = "test_user"

export async function uploadToBlobStorage(file: File, name: string) {
    
    // File offset - file will be apended to at this byte location
    let offset = 0
    // Initialize filer object
    //var filer: FilerUtils = new FilerUtils(filerIp, folderName, "")
    // Initialize filer object
    var seaweed: SeaweedUploader = new SeaweedUploader(filerIp, folderName, "", 10)
    // Check if folder exists
    let folder = await seaweed.FindFolder()
    console.log(folder)
    if (folder != 0) {
        seaweed.CreateFolder()
    }
    // Check if file is found on server
    // Will return -1 or stored file size
    var metadata = await seaweed.GetFileMetadata(name)
    if (metadata === file.size) {
        // Already uploaded
        return
    }
    if (metadata != -1) {
        offset = metadata
    }
    // uploadFile at offset with file name and progress variable
    seaweed.HandleFile(file, name, (progress: number) => { uploadFileData.progress = progress; console.log(uploadFileData.progress) }, offset)
}

// Get test input
var input: HTMLInputElement = <HTMLInputElement>document.getElementById("file")

const onSelectedFile = () => {
    var files = input.files
    if (files != null) {
        var file: File = files[0]
        uploadToBlobStorage(file, file.name)
    }
}
input.addEventListener('change', onSelectedFile, false)

