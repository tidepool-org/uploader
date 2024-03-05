const std = @import("std");
const windows = @import("std").os.windows;
const W = std.unicode.utf8ToUtf16LeStringLiteral;
const Allocator = std.mem.allocator;

const OpenError = error {
	InvalidHandle,
	LockFailed,
	ReadFailed,	
};

fn openDevice() !windows.HANDLE {
    const devicePath = "\\\\.\\E:"; // Change C: to your target volume
    const FSCTL_LOCK_VOLUME = 0x00090018;

    // Open the volume
    const handle = windows.kernel32.CreateFileW(
	W(devicePath),
	windows.GENERIC_READ | windows.GENERIC_WRITE,
	windows.FILE_SHARE_READ | windows.FILE_SHARE_WRITE,
	null,
	windows.OPEN_EXISTING,
	windows.FILE_FLAG_NO_BUFFERING,
	null);

    if (handle == windows.INVALID_HANDLE_VALUE) {
        try sendReply("error", "Failed to open file");
        return OpenError.InvalidHandle;
    }
	
    // Lock the volume
    windows.DeviceIoControl(
        handle,
        FSCTL_LOCK_VOLUME,
        null,
        null,
    ) catch {
		try sendReply("error", "Failed to lock volume");
        windows.CloseHandle(handle);
        return OpenError.LockFailed;
    };

    try sendReply("success", "Volume locked successfully");
    
    return handle;
}
    
fn checkDevice(handle: windows.HANDLE) !void {
    const allocator = std.heap.page_allocator;
    const alignment = 4096;
    const size = 512;

    const buffer = try allocator.alignedAlloc(u8, alignment, size);
    defer allocator.free(buffer);

    @memset(buffer, 0);

    try sendReply("info", "Reading from volume..");

    var bytesRead: windows.DWORD = 0;
    const readSuccess = windows.kernel32.ReadFile(handle, buffer.ptr, size, &bytesRead, null);
    if (readSuccess == 0) {
        try sendReply("error", "Failed to read from volume");
		return OpenError.ReadFailed;
    }

    var gpa = std.heap.GeneralPurposeAllocator(.{}){};
    const printAllocator = gpa.allocator();

    const slice = try std.fmt.allocPrint(printAllocator, "Read {d} bytes from volume.", .{bytesRead});
	defer printAllocator.free(slice);
    try sendReply("info", slice);
    try sendReply("data", buffer[0x2b..0x3b]);
}

fn retrieveData(seekOffset: u64, linkLayerFrame: []const u8, handle: windows.HANDLE ) !void {
    const allocator = std.heap.page_allocator;
    const alignment = 4096;
    const size = 512;

    var gpa = std.heap.GeneralPurposeAllocator(.{}){};
    const printAllocator = gpa.allocator();
    
	const buffer = try allocator.alignedAlloc(u8, alignment, size);
	defer allocator.free(buffer);

	@memset(buffer, 0);
	@memcpy(buffer[0..linkLayerFrame.len], linkLayerFrame);

	try sendReply("info", "Sending request");

	_ = try windows.WriteFile(handle, buffer, seekOffset);

	@memset(buffer, 0);

	const bytesRead = try windows.ReadFile(handle, buffer, seekOffset);

	const slice = try std.fmt.allocPrint(printAllocator, "Read {d} bytes from volume.", .{bytesRead});
	defer printAllocator.free(slice);
	try sendReply("info", slice);
	try sendReply("data", buffer);
}

pub fn main() !void { 

    const stdin = std.io.getStdIn().reader();
    var buffer: [4096]u8 = undefined;
   	var handle: windows.HANDLE = undefined;

   	var gpa = std.heap.GeneralPurposeAllocator(.{}){};
   	const allocator = gpa.allocator();

   	const Message = struct {
   		command: []u8,
   		request: [512]u8 = undefined,
   		seekOffset: u64 = 0,
   	};

    while (true) {

	    // Read the length of the incoming message
	    _ = try stdin.read(&buffer);
	    
	    const length = std.mem.readInt(u32, buffer[0..4], .little);
	    
	    // Read the message based on the length
	    const message = std.mem.bytesAsSlice(u8, buffer[4..(length+4)]);

	    const parsed = try std.json.parseFromSlice(
	        Message,
	        allocator,
	        message,
	        .{},
	    );

	    const data = parsed.value;

	    if (std.mem.eql(u8, data.command, "openDevice")) {
	    	try sendReply("info", "Trying to open device");
			handle = try openDevice();
		}

		if (std.mem.eql(u8, data.command, "checkDevice")) {
			try sendReply("info", "Checking device");
			try checkDevice(handle);
		}

		if (std.mem.eql(u8, data.command, "retrieveData")) {
			try sendReply("info", "Retrieving data");
			try retrieveData(data.seekOffset, &data.request, handle);
		}

		if (std.mem.eql(u8, data.command, "closeDevice")) {
			try sendReply("info", "Closing device");
			break;
		}

		parsed.deinit();
	}

	// exit gracefully
	windows.CloseHandle(handle);
	std.os.exit(0);
}



fn sendReply(msgtype: []const u8, result: []const u8) !void {
    const stdout = std.io.getStdOut().writer();
    
    var gpa = std.heap.GeneralPurposeAllocator(.{}){};
    defer _ = gpa.deinit();
    const allocator = gpa.allocator();
    var string = std.ArrayList(u8).init(allocator);

    const Reply = struct {
    	msgType: []const u8,
        details: []const u8,
    };
    
    const x = Reply{
    	.msgType = msgtype,
        .details = result,
    };

    try std.json.stringify(x, .{}, string.writer());
    const response = try string.toOwnedSlice();
            
    var response_length: [4]u8 = undefined;
    std.mem.writeInt(u32, &response_length, @intCast(response.len), .little);
    _ = try stdout.write(&response_length);
    _ = try stdout.writeAll(response);
}
