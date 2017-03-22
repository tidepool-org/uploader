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
| Header    | 2     | Bytes      | `0x5103` (`0x03` is an NGP device)     |
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
An **Open Connection Request** is sent from the driver to the Contour Next Link 2.4 to authenticate with it.
An **Open Connection Request** is contained in the payload of a [MiniMed Message](#minimed-message) where the Minimed Operation is `0x10` (OPEN_CONNECTION).

![Open Connection Request](images/svg/OpenConnectionRequest.svg)

| Field     | Bytes | Data Type  |   Comments   |
|-----------|:-----:|:----------:|--------------|
| HMAC      | 32    | Bytes      | The HMAC is generated using a proprietary algorithm from the Contour Next Link 2.4's **Model and Serial Number** string, which is obtained from the Header ASTM response from sending the initial **X** message to the CNL2.4 |

### Open Connection Response
The **Open Connection Response** is currently ignored by the driver.

### Read Info Request
A **Read Info Request** is sent from the driver to the Contour Next Link 2.4 to determine whether the CNL2.4 is paired with a 600-series pump.
A **Read Info Request** is contained in the payload of a [MiniMed Message](#minimed-message) where the Minimed Operation is `0x14` (READ_INFO). It has no message payload.

### Read Info Response
A **Read Info Response** is contained in the payload of a [MiniMed Message](#minimed-message) where the Minimed Operation is `0x14` (READ_INFO).

![Read Info Response](images/svg/ReadInfoResponse.svg)

| Field     | Bytes | Data Type  |   Comments   |
|-----------|:-----:|:----------:|--------------|
| CNL MAC   | 8     | UInt64BE   | ZigBee MAC Address of the Contour Next Link |
| Pump MAC  | 8     | UInt64BE   | ZigBee MAC Address of the 600-series pump |
| Link Counter  | 2     | UInt16LE   | Number of times that this CNL/Pump combination have been paired |
| Mode Flags    | 1     | Byte       | Mode flags for this pairing. If the lowest bit is set, encryption is enabled |

### Link Key Request
A **Link Key Request** is sent from the driver to the Contour Next Link 2.4 to get the Link Key for the paired CNL and pump. The Link Key is used to generate the encryption key for the AES encoded data later in the session.
A **Link Key Request** is contained in the payload of a [MiniMed Message](#minimed-message) where the Minimed Operation is `0x16` (REQUEST_LINK_KEY). It has no message payload.

### Link Key Response
A **Link Key Response** is contained in the payload of a [MiniMed Message](#minimed-message) where the Minimed Operation is `0x86` (REQUEST_LINK_KEY_RESPONSE).

![Link Key Response](images/svg/LinkKeyResponse.svg)

| Field     | Bytes | Data Type  |   Comments   |
|-----------|:-----:|:----------:|--------------|
| Link Key  | 55    | Bytes      | Link Key for the current CNL/pump pairing |

The key for the AES encrypted data in **NGP Message**s is generated using a proprietary algorithm based on the Link Key.

### NGP Message
An **NGP Message** is contained in the payload of a [MiniMed Message](#minmed-message) where the MiniMed Operation is `0x12` (SEND_MESSAGE), `0x80` (RECEIVE_MESSAGE) or `0x81` (SEND_MESSAGE_RESPONSE).

![NGP Message](images/svg/NGPMessage.svg)

| Field     | Bytes | Data Type  |   Comments   |
|-----------|:-----:|:----------:|--------------|
| Command   | 1     | Byte       | *See table below* |
| Size      | 1     | UInt8      | Size of the Payload and Checksum |
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
| `0x07`    | READ_STATUS |
| `0x08`    | READ_NETWORK_STATUS |
| `0x0c`    | SET_SECURITY_MODE |
| `0x0d`    | READ_STATISTICS |
| `0x0e`    | SET_RF_MODE |
| `0x10`    | CLEAR_STATUS |
| `0x14`    | SET_LINK_KEY |
| `0x55`    | COMMAND_RESPONSE |

### Join Network Request
![Join Network Response](images/svg/JoinNetworkRequest.svg)
A **Join Network Request** is sent from the driver to the Contour Next Link 2.4 to attempt to join the pump's ZigBee network.
A **Join Network Request** is contained in the payload of a [NGP Message](#ngp-message) where the Command is `0x03` (JOIN_NETWORK).

| Field     | Bytes | Data Type  |   Comments   |
|-----------|:-----:|:----------:|--------------|
| Sequence Number  | 1     | UInt8      | NGP Sequence Number (always 1 when a `Join Network Request`) |
| Radio Channel    | 1     | UInt8      | ZigBee (IEEE 802.15.4) radio channel to try comms on. *See table below* |
| Padding   | 3     | Bytes      | Null Padded  |
| `0x07`    | 1     | Byte       | Unknown meaning |
| `0x07`    | 1     | Byte       | Unknown meaning |
| Padding   | 2     | Bytes      | Null Padded  |
| `0x02`    | 1     | Byte       | Unknown meaning |
| CNL MAC   | 8     | UInt64LE   | ZigBee MAC Address of the Contour Next Link |
| Pump MAC   | 8     | UInt64LE   | ZigBee MAC Address of the 600-series pump |

#### Radio Channels
| Channel   | Comments |
|-----------|-----------|
| `0x0E`    | Channel 14 - 2420MHz |
| `0x11`    | Channel 17 - 2435MHz |
| `0x14`    | Channel 20 - 2450MHz |
| `0x17`    | Channel 23 - 2465MHz |
| `0x1A`    | Channel 26 - 2480MHz |

### Join Network Response
![Join Network Response](images/svg/JoinNetworkResponse.svg)

| Field     | Bytes | Data Type  |   Comments   |
|-----------|:-----:|:----------:|--------------|
| `0x00`    | 1     | Byte       | Unknown meaning |
| `0x04`    | 1     | Byte       | Unknown meaning |
| Pump Serial | 5     | Bytes      | The pump's serial as a 40-bit unsigned LE integer |
| `0x02`    | 1     | Byte       | Unknown meaning |
| Pump MAC   | 8     | UInt64LE   | ZigBee MAC Address of the 600-series pump |
| `0x82`    | 1     | Byte       | Exact meaning unknown, but is `0x82` if the network has been joined |
| Padding   | 5     | Bytes      | Null Padded  |
| `0x07`    | 1     | Byte       | Unknown meaning |
| Padding   | 1     | Byte       | Null Padded  |
| `0x28`    | 1     | Byte       | Unknown meaning |
| CNL MAC    | 8     | UInt64LE   | ZigBee MAC Address of the Contour Next Link 2.4 |
| `0x42`    | 1     | Byte       | Exact meaning unknown, but is `0x42` if the network has been joined |
| Padding   | 7     | Bytes      | Null Padded  |
| Radio Channel | 1     | UInt8      | ZigBee (IEEE 802.15.4) radio channel on which the network has been joined. |

If the network is not joined, the response has a payload of 9 bytes, whose structure is currently unknown.

### Transmit Packet Request
A **Transmit Packet Request** is contained in the payload of an [NGP Message](#ngp-message) where the Command is `0x05` (TRANSMIT_MESSAGE).

![Transmit Packet Request](images/svg/TransmitPacketRequest.svg)

| Field     | Bytes | Data Type  |   Comments   |
|-----------|:-----:|:----------:|--------------|
| Pump MAC   | 8     | UInt64LE   | ZigBee MAC Address of the 600-series pump |
| Sequence Number  | 1     | UInt8      | NGP Sequence Number |
| Mode Flags    | 1     | Byte       | Mode flags for this message. *See table below* |
| Size      | 1     | UInt8      | Size of the Encrypted Payload |
| Encrypted Payload | Variable | Bytes      | Size specified by **Size** |

The encryption mechanism is AES using CFB Mode (`AES/CFB/NoPadding` in Java, `aes-128-cfb` in the Node Crypto library).  
The key is determined from the **Link Key Request**, and the IV is the same as the key, but the first byte is changed to the **Radio Channel** on which the CNL and Pump are connected.

#### Mode Flags
| Flag      | Meaning  |
|-----------|-----------|
| `0x01`    | Encryption enabled |
| `0x10`    | High Speed enabled |

Mode flags can be `|`ed together. For example, if both encrypted and high speed mode were enabled, the Mode Flags byte would be `0x11`.

### Transmit Packet Response
A **Transmit Packet Response** is contained in the payload of an [NGP Message](#ngp-message) where the Command is `0x55` (COMMAND_RESPONSE) and the MiniMed Operation is `0x80`.

![Transmit Packet Response](images/svg/TransmitPacketResponse.svg)

| Field     | Bytes | Data Type  |   Comments   |
|-----------|:-----:|:----------:|--------------|
| `0x00`    | 1     | Byte       | Unknown meaning |
| `0x06`    | 1     | Byte       | Unknown meaning |
| Pump MAC   | 8     | UInt64LE   | ZigBee MAC Address of the 600-series pump |
| CNL MAC    | 8     | UInt64LE   | ZigBee MAC Address of the Contour Next Link 2.4 |
| Sequence Number  | 1     | UInt8      | NGP Sequence Number |
| Unknown bytes    | 2     | Bytes       | Unknown meaning |
| Size      | 1     | UInt8      | Size of the Encrypted Payload |
| Encrypted Payload | Variable | Bytes      | Size specified by **Size** |
