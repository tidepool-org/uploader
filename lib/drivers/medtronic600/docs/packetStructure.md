# Medtronic 600-series message structure

Below we've documented the structure of the various packets for the Medtronic 600-series pump, matching the fields and record types to our [data model](http://developer.tidepool.io/data-model). Unknown bits are designated with `??`.

## Bayer Contour Next Link messages

### USB Packet
All other messages are broken down to USB packets before being sent on the HID interface.
![USB Packet](images/svg/BayerUSB.svg)

| Field     | Bytes | Data Type  |   Comments   |
|-----------|:-----:|:----------:|--------------|
| Header    | 3     | String     | `'ABC'`      |
| Payload size | 1     | UInt8      |              |
| Payload   | 60    | Bytes      | |

### MiniMed Message
A **MiniMed Message** is broken up into [USB Packet](#usb-packet)s.
![MiniMed Message](images/svg/MiniMedMessage.svg)

| Field     | Bytes | Data Type  |   Comments   |
|-----------|:-----:|:----------:|--------------|
| Header    | 2     | Bytes      | `0x5103`     |
| Pump Serial Number | 6     | String     | ASCII numbers, always `'000000'` for 600-series |
| Padding   | 10    | Bytes      | Null Padded  |
| Operation | 1     | Byte       | *See table below* |
| Sequence Number | 4     | UInt32LE   | |
| Padding   | 5     | Bytes      | Null Padded  |
| Payload Size | 2     | UInt16LE   | |
| Padding   | 2     | Bytes      | Null Padded  |
| Checksum  | 1     | UInt8      | Sum of the *entire* message, not including the **Checksum** byte itself  |
| Payload   | Variable | Bytes      | Size specified by **Payload Size** |

#### Operation
| Value     | Operation                  |
|-----------|----------------------------|
| `0x10`    |  OPEN_CONNECTION           |
| `0x11`    |  CLOSE_CONNECTION          |
| `0x12`    |  SEND_MESSAGE              |
| `0x14`    |  READ_INFO                 |
| `0x16`    |  REQUEST_LINK_KEY          |
| `0x17`    |  SEND_LINK_KEY             |
| `0x80`    |  RECEIVE_MESSAGE           |
| `0x81`    |  SEND_MESSAGE_RESPONSE     |
| `0x86`    |  REQUEST_LINK_KEY_RESPONSE |

### Open Connection Request
An **Open Connection Request** is sent from the app to the Contour Next Link 2.4 to authenticate with it, and to check whether the CNL2.4 is paired with a 600-series pump.
An **Open Connection Request** is contained in the payload of a [MiniMed Message](#minimed-message) when the Minimed Operation is `0x10` (OPEN_CONNECTION) and the data is being sent **to** the CNL2.4.
![Open Connection Request](images/svg/OpenConnectionRequest.svg)

| Field     | Bytes | Data Type  |   Comments   |
|-----------|:-----:|:----------:|--------------|
| HMAC      | 32    | Bytes      | The HMAC is generated using a proprietary algorithm from the Contour Next Link 2.4's **Model and Serial Number** string, which is obtained from the Header ASTM response from sending the initial **X** message to the CNL2.4 |

### NGP Message
An **NGP Message** is contained in the payload of a [MiniMed Message](#minmed-message) when the MiniMed Operation is `0x12` (SEND_MESSAGE), `0x80` (RECEIVE_MESSAGE) or `0x81` (SEND_MESSAGE_RESPONSE).
![NGP Message](images/svg/NGPMessage.svg)

| Field     | Bytes | Data Type  |   Comments   |
|-----------|:-----:|:----------:|--------------|
| Command   | 1     | Byte       | *See table below* |
| Size      | 1     | UInt8      | Size of the whole NGP message, not including the 2-byte CRC |
| Payload   | Variable | Bytes      | Size specified by **Size - 2** |
| CRC       | 2     | UInt16LE   | CCITT checksum of the **Payload** |

#### Command
| Value     | Operation |
|-----------|-----------|
| `0x01`    | INITIALIZE |
| `0x02`    | SCAN_NETWORK |
| `0x03`    | JOIN_NETWORK |
| `0x04`    | LEAVE_NETWORK |
| `0x05`    | TRANSMIT_PACKET |
| `0x06`    | READ_DATA |
| `0x06`    | READ_STATUS |
| `0x06`    | READ_NETWORK_STATUS |
| `0x0c`    | SET_SECURITY_MODE |
| `0x0d`    | READ_STATISTICS |
| `0x0e`    | SET_RF_MODE |
| `0x10`    | CLEAR_STATUS |
| `0x14`    | SET_LINK_KEY |
| `0x55`    | COMMAND_RESPONSE |
