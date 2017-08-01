--
-- Wireshark plugin to dissect the USB HID packets of the Abbott FreeStyle Libre
--

-- TODO: does not yet handle AAP frame reassembly


local fslibre_usb = Proto("fslibre_usb", "Abbott FreeStyle Libre USB Protocol")

local fslibre_dump = ProtoField.new("FSLibre Dump", "fslibre_usb.dump", ftypes.BYTES)

local command = ProtoField.new("Command", "fslibre_usb.command", ftypes.UINT8, nil, base.HEX)
local data_length = ProtoField.new("Data Length", "fslibre_usb.data_length", ftypes.UINT8)

local text = ProtoField.new("Text", "fslibre_usb.text", ftypes.STRING)

local atp_frame = ProtoField.new("ATP Frame", "fslibre_usb.atp", ftypes.NONE)
local atp_data = ProtoField.new("ATP Data", "fslibre_usb.atp.data", ftypes.BYTES)
local atp_sequence_received = ProtoField.new("ATP Seq Rx", "fslibre_usb.atp.sequence_received", ftypes.UINT8)
local atp_sequence_sent = ProtoField.new("ATP Seq Tx", "fslibre_usb.atp.sequence_sent", ftypes.UINT8)
local atp_crc32 = ProtoField.new("ATP CRC32", "fslibre_usb.atp.crc32", ftypes.UINT32, nil, base.HEX)
local atp_crc32bin = ProtoField.new("ATP CRC32 BIN", "fslibre_usb.atp.crc32bin", ftypes.STRING)
local atp_unknown = ProtoField.new("ATP UNKNOWN", "fslibre_usb.atp.unknown", ftypes.UINT16, nil, base.HEX)

local aap_frame = ProtoField.new("AAP Frame", "fslibre_usb.aap", ftypes.NONE)
local aap_data_length = ProtoField.new("AAP Data Length", "fslibre_usb.aap.data_length", ftypes.UINT32)
local aap_op_code = ProtoField.new("AAP OP Code", "fslibre_usb.aap.op_code", ftypes.UINT8, nil, base.HEX)
local aap_data = ProtoField.new("AAP Data", "fslibre_usb.aap.data", ftypes.BYTES)


fslibre_usb.fields = {
    fslibre_dump,
    command,
    text,
    atp_frame,
    data_length,
    atp_data,
    atp_sequence_received,
    atp_sequence_sent,
    atp_crc32,
    atp_crc32bin,
    atp_unknown,
    aap_frame,
    aap_data_length,
    aap_op_code,
    aap_data
}

local hid_report_length = 64


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


local function dissect_aap(atp_payload_buf, pktinfo, atp_tree)
    local aap_frame_offset = 0

    repeat
        local aap_data_length_num_bytes = 0
        local aap_data_length_value = 0
        -- the first 0 to 3 bytes describe the aap frame length in their lower 7 bits
        for i = 0, 2 do
            local byte_value = atp_payload_buf:range(aap_frame_offset + i, 1):uint()
            -- if highest bit is not set, this is already the command byte
            if not bit32.btest(byte_value, 0x80) then
                break
            end
            -- highest bit was set, add lower 7 bits to length value
            aap_data_length_value = bit32.lshift(aap_data_length_value, 7)
            aap_data_length_value = bit32.bor(aap_data_length_value, bit32.band(byte_value, 0x7f))
            aap_data_length_num_bytes = aap_data_length_num_bytes + 1
        end

        -- check that opcode does not have the highest bit set, otherwise cancel parsing due to faulty data
        local aap_op_code_value = atp_payload_buf:range(aap_frame_offset + aap_data_length_num_bytes, 1):uint()
        if bit32.btest(aap_op_code_value, 0x80) then
            break
        end

        local aap_data_offset = aap_frame_offset + aap_data_length_num_bytes + 1
        local aap_data_length_in_this_frame = math.min(atp_payload_buf:len() - aap_data_offset, aap_data_length_value)

        -- add new aap sub-tree
        local aap_tree = atp_tree:add(aap_frame, atp_payload_buf:range(aap_frame_offset, aap_data_length_num_bytes + 1 + aap_data_length_in_this_frame))

        -- mark the aap data length bytes at the aap frame start
        aap_tree:add(aap_data_length, atp_payload_buf:range(aap_frame_offset, aap_data_length_num_bytes), aap_data_length_value)

        -- aap op code is the first byte after the aap length
        aap_tree:add(aap_op_code, atp_payload_buf:range(aap_frame_offset + aap_data_length_num_bytes, 1))

        if aap_data_length_value > 0 then
            -- aap data bytes start after the op code
            aap_tree:add(aap_data, atp_payload_buf:range(aap_data_offset, aap_data_length_in_this_frame))
        end

        aap_frame_offset = aap_data_offset + aap_data_length_value
    until aap_frame_offset >= atp_payload_buf:len()
end


function fslibre_usb.dissector(tvbuf, pktinfo, root)

    pktinfo.cols.protocol:set("fslibre_usb")
    local pktlen = tvbuf:reported_length_remaining()

    local hid_report_buf

    if pktlen < hid_report_length then
        return pktlen
    elseif pktlen == hid_report_length then
        hid_report_buf = tvbuf
    elseif pktlen > hid_report_length then
        hid_report_buf = tvbuf:range(pktlen - hid_report_length, hid_report_length):tvb()
    end

    pktinfo.cols.protocol = fslibre_usb.name

    local command_value = hid_report_buf:range(0, 1):uint()
    local data_length_value = hid_report_buf:range(1, 1):uint()

    local tree = root:add(fslibre_usb, hid_report_buf:range(0, 2 + data_length_value))

    -- add hidden field that can be used in custom column to show whole packet data
    tree:add(fslibre_dump, hid_report_buf:range(0, 2 + data_length_value)):set_hidden()

    -- actually the command is only in the lower 6 bits of the first byte,
    -- but the 2 high bits are currently always 0 anyhow
    tree:add(command, hid_report_buf:range(0, 1))

    tree:add(data_length, hid_report_buf:range(1, 1))

    if data_length_value > 0 then
        local data_offset = 2

        if command_value == 0x60 or command_value == 0x21 or command_value == 0x06 or command_value == 0x35 then
            tree:add(text, hid_report_buf:range(data_offset, data_length_value))

        else
            local atp_tree = tree:add(atp_frame, hid_report_buf:range(data_offset, data_length_value))

            local atp_data_buf = hid_report_buf:range(data_offset, data_length_value):tvb()
            atp_tree:add(atp_data, atp_data_buf:range()):set_hidden()

            if data_length_value >= 2 then
                atp_tree:add(atp_sequence_received, atp_data_buf:range(0, 1))
                atp_tree:add(atp_sequence_sent, atp_data_buf:range(1, 1))

                if data_length_value >= 6 then
                    atp_tree:add(atp_crc32, atp_data_buf:range(2, 4))

                    local crc32_value = atp_data_buf:range(2, 4):uint()
                    atp_tree:add(atp_crc32bin, atp_data_buf:range(2, 4), to_bits(crc32_value, 32)):set_hidden()

                    if data_length_value > 6 then
                        dissect_aap(atp_data_buf:range(6):tvb(), pktinfo, atp_tree)
                    end
                elseif data_length_value == 4 then
                    atp_tree:add(atp_unknown, atp_data_buf:range(2, 2))
                end
            end
        end
    end

    return pktlen
end

function fslibre_usb.init()
    --  register this disector for USB vendor:product 1a61:3650
    DissectorTable.get("usb.product"):add(0x1a613650, fslibre_usb)
end

