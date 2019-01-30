--
-- Wireshark plugin to dissect the USB HID packets of the Abbott FreeStyle Libre
--

-- needed for debugging this script
--_G.debug = require("debug")
--require("mobdebug").start()
--

local fslibre_usb = Proto("fslibre_usb", "Abbott FreeStyle Libre USB Protocol")

local fslibre_dump = ProtoField.new("FSLibre Dump", "fslibre_usb.dump", ftypes.BYTES)

local command = ProtoField.new("Command", "fslibre_usb.command", ftypes.UINT8, nil, base.HEX)
local data_length = ProtoField.new("Data Length", "fslibre_usb.data_length", ftypes.UINT8)

local text = ProtoField.new("Text", "fslibre_usb.text", ftypes.STRING)

local atp_frame = ProtoField.new("ATP Frame", "fslibre_usb.atp", ftypes.NONE)
local atp_data = ProtoField.new("ATP Data", "fslibre_usb.atp.data", ftypes.BYTES)
local atp_sequence_rx = ProtoField.new("ATP Seq Rx", "fslibre_usb.atp.sequence_rx", ftypes.UINT8)
local atp_sequence_tx = ProtoField.new("ATP Seq Tx", "fslibre_usb.atp.sequence_tx", ftypes.UINT8)
local atp_crc32 = ProtoField.new("ATP CRC32", "fslibre_usb.atp.crc32", ftypes.UINT32, nil, base.HEX)
local atp_crc32bin = ProtoField.new("ATP CRC32 BIN", "fslibre_usb.atp.crc32bin", ftypes.STRING)
local atp_unknown = ProtoField.new("ATP UNKNOWN", "fslibre_usb.atp.unknown", ftypes.UINT16, nil, base.HEX)

local aap_frame = ProtoField.new("AAP Frame", "fslibre_usb.aap", ftypes.STRING)
local aap_data_length = ProtoField.new("AAP Data Length", "fslibre_usb.aap.data_length", ftypes.UINT32)
local aap_op_code = ProtoField.new("AAP OP Code", "fslibre_usb.aap.op_code", ftypes.UINT8, nil, base.HEX)
local aap_data = ProtoField.new("AAP Data", "fslibre_usb.aap.data", ftypes.BYTES)
local aap_dump = ProtoField.new("AAP Dump", "fslibre_usb.aap.dump", ftypes.BYTES)


fslibre_usb.fields = {
    fslibre_dump,
    command,
    text,
    atp_frame,
    data_length,
    atp_data,
    atp_sequence_rx,
    atp_sequence_tx,
    atp_crc32,
    atp_crc32bin,
    atp_unknown,
    aap_frame,
    aap_data_length,
    aap_op_code,
    aap_data,
    aap_dump
}

local HID_REPORT_LENGTH = 64
local AAP_OPCODE_LENGTH = 1

local pkt_state = {}
local partial_aap_buf = {}

local function to_bits(num, bits)
    -- returns a string of bits, most significant first
    bits = bits or math.max(1, select(2, math.frexp(num)))
    local t = {} -- table containing the bits
    for b = bits, 1, -1 do
        t[b] = math.fmod(num, 2)
        num = math.floor((num - t[b]) / 2)
    end
    return table.concat(t) -- convert table to string
end


local function dissect_aap(atp_payload_buf, atp_tree)
    local aap_data_length_num_bytes = 0
    local aap_data_length_value = 0
    -- the first 0 to 3 bytes describe the aap frame length in their lower 7 bits in little endian
    for i = 0, 2 do
        -- if we are still parsing the length when we reach the buffer's end, we need at least 1 more byte
        if i >= atp_payload_buf:len() then
            -- show data as partial aap frame
            atp_tree:add(aap_frame, atp_payload_buf:range(0), "[partial]: length not known yet")
            return -1
        end

        local byte_value = atp_payload_buf:range(i, 1):uint()
        -- if highest bit is not set, this is already the command byte
        if not bit32.btest(byte_value, 0x80) then
            break
        end
        -- highest bit was set, extract lower 7 bits as length value
        local byte_length_value = bit32.band(byte_value, 0x7f)
        -- shift these 7 bits to the left depending on the index i
        byte_length_value = bit32.lshift(byte_length_value, 7 * i)
        -- combine these bits with the previous length value
        aap_data_length_value = bit32.bor(byte_length_value, aap_data_length_value)
        aap_data_length_num_bytes = aap_data_length_num_bytes + 1
    end

    local aap_data_offset = aap_data_length_num_bytes + AAP_OPCODE_LENGTH
    local aap_data_length_in_this_frame = math.min(atp_payload_buf:len() - aap_data_offset, aap_data_length_value)

    -- if aap packet is longer than current buffer, return number of missing bytes as negative number
    if aap_data_length_in_this_frame < aap_data_length_value then
        -- show data as partial aap frame, with info about missing bytes and possibly opcode
        local op_code_info = ""
        if atp_payload_buf:len() > aap_data_length_num_bytes then
            local aap_op_code_value = atp_payload_buf:range(aap_data_length_num_bytes, 1):uint()
            op_code_info = string.format("[OP Code 0x%x]", aap_op_code_value)
        end
        local description = string.format("[partial]%s %d of %d bytes",
            op_code_info,
            aap_data_offset + aap_data_length_in_this_frame,
            aap_data_offset + aap_data_length_value)
        atp_tree:add(aap_frame, atp_payload_buf:range(0), description)

        return - (aap_data_length_value - aap_data_length_in_this_frame)
    end

    -- check that opcode does not have the highest bit set, otherwise cancel parsing due to faulty data
    local aap_op_code_value = atp_payload_buf:range(aap_data_length_num_bytes, 1):uint()
    if bit32.btest(aap_op_code_value, 0x80) then
        return 0
    end

    -- add new aap sub-tree
    local aap_tree = atp_tree:add(aap_frame,
        atp_payload_buf:range(0, aap_data_length_num_bytes + AAP_OPCODE_LENGTH + aap_data_length_in_this_frame), "")

    -- add hidden field that can be used in custom column to show aap packet data
    aap_tree:add(aap_dump, atp_payload_buf:range(0, aap_data_offset + aap_data_length_in_this_frame)):set_hidden()

    -- mark the aap data length bytes at the aap frame start
    aap_tree:add(aap_data_length, atp_payload_buf:range(0, aap_data_length_num_bytes), aap_data_length_value)

    -- aap op code is the first byte after the aap length
    aap_tree:add(aap_op_code, atp_payload_buf:range(aap_data_length_num_bytes, AAP_OPCODE_LENGTH))

    if aap_data_length_in_this_frame > 0 then
        -- aap data bytes start after the op code
        aap_tree:add(aap_data, atp_payload_buf:range(aap_data_offset, aap_data_length_in_this_frame))
    end

    return aap_data_offset + aap_data_length_in_this_frame
end


local function reassemble_aap(atp_data_buf, pktinfo, atp_tree)

    local aap_buf
    local state = pkt_state[pktinfo.number]

    if state ~= nil then
        -- we've already processed this packet
        aap_buf = ByteArray.tvb(state.buffer, "AAP Buffer")
        state.processed = True
    else
        -- first time processing this packet
        state = {}

        if partial_aap_buf[tostring(pktinfo.src)] ~= nil then
            partial_aap_buf[tostring(pktinfo.src)]:append(atp_data_buf(0):bytes())
            aap_buf = ByteArray.tvb(partial_aap_buf[tostring(pktinfo.src)], "AAP Buffer")
        else
            aap_buf = atp_data_buf
        end
    end

    if state.processed == nil then
        state.buffer = aap_buf(0):bytes()
    end

    while aap_buf:len() > 0 do
        local aap_packet_length = dissect_aap(aap_buf, atp_tree)

        if aap_packet_length == 0 then

            -- error disecting aap
            if state.processed == nil then
                pkt_state[pktinfo.number] = state
                partial_aap_buf[tostring(pktinfo.src)] = nil
            end
            return

        elseif aap_packet_length < 0 then

            -- we don't have all the data we need yet
            if state.processed == nil then
                -- save remaining data
                partial_aap_buf[tostring(pktinfo.src)] = aap_buf(0):bytes()
                pkt_state[pktinfo.number] = state
            end
            return

        else
            -- consumed one aap packet from aap_buf, remove it and continue parsing
            aap_buf = aap_buf:range(aap_packet_length):tvb()
        end
    end

    if state.processed == nil then
        -- emptied aap_buf without any remaining partial aap data
        pkt_state[pktinfo.number] = state
        partial_aap_buf[tostring(pktinfo.src)] = nil
    end
end



function fslibre_usb.dissector(tvbuf, pktinfo, root)

    pktinfo.cols.protocol:set("fslibre_usb")
    local pktlen = tvbuf:len()

    if pktlen < HID_REPORT_LENGTH then
        -- tell Wireshark that this packet was not for us
        return 0
    end

    -- cut off leading data before the actual HID report, which is always 64 bytes
    local hid_report_buf = tvbuf:range(pktlen - HID_REPORT_LENGTH, HID_REPORT_LENGTH):tvb()

    pktinfo.cols.protocol = fslibre_usb.name

    local command_value = hid_report_buf:range(0, 1):uint()
    local data_length_value = hid_report_buf:range(1, 1):uint()

    local data_offset = 2
    local tree = root:add(fslibre_usb, hid_report_buf:range(0, data_offset + data_length_value))

    -- add hidden field that can be used in custom column to show whole packet data
    tree:add(fslibre_dump, hid_report_buf:range(0, data_offset + data_length_value)):set_hidden()

    -- actually the command is only in the lower 6 bits of the first byte,
    -- but the 2 high bits are currently always 0 anyhow
    tree:add(command, hid_report_buf:range(0, 1))

    tree:add(data_length, hid_report_buf:range(1, 1))

    if data_length_value > 0 then
        if command_value == 0x60 or command_value == 0x21 or command_value == 0x06 or command_value == 0x35 then
            tree:add(text, hid_report_buf:range(data_offset, data_length_value))

        else
            local atp_tree = tree:add(atp_frame, hid_report_buf:range(data_offset, data_length_value))

            local atp_buf = hid_report_buf:range(data_offset, data_length_value):tvb()
            atp_tree:add(atp_data, atp_buf:range()):set_hidden()

            if data_length_value >= 2 then
                atp_tree:add(atp_sequence_rx, atp_buf:range(0, 1))
                atp_tree:add(atp_sequence_tx, atp_buf:range(1, 1))

                if data_length_value >= 6 then
                    atp_tree:add(atp_crc32, atp_buf:range(2, 4))

                    local crc32_value = atp_buf:range(2, 4):uint()
                    atp_tree:add(atp_crc32bin, atp_buf:range(2, 4), to_bits(crc32_value, 32)):set_hidden()

                    if data_length_value > 6 then
                        reassemble_aap(atp_buf:range(6):tvb(), pktinfo, atp_tree)
                    end

                elseif data_length_value == 4 then
                    atp_tree:add(atp_unknown, atp_buf:range(2, 2))
                end
            end
        end
    end
end


function fslibre_usb.init()
    -- needed to track the state of aap reassembly
    pkt_state = {}
    partial_aap_buf = {}

    --  register this disector for USB vendor:product 1a61:3650 (FreeStyle Libre)
    DissectorTable.get("usb.product"):add(0x1a613650, fslibre_usb)

    --  register this disector for USB vendor:product 1a61:3670 (FreeStyle Libre Pro)
    DissectorTable.get("usb.product"):add(0x1a613670, fslibre_usb)
end

