// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title CertificateVerification
 * @notice Smart contract for storing and verifying educational certificate hashes on-chain
 * @dev Only stores SHA256 hashes, never full certificate data
 */
contract CertificateVerification {
    // Owner of the contract
    address public owner;

    // Event emitted when a certificate is registered
    event CertificateRegistered(
        bytes32 certificateHash,
        address registrant,
        uint256 timestamp,
        string metadata
    );

    // Event emitted when a certificate is revoked
    event CertificateRevoked(
        bytes32 certificateHash,
        address revoker,
        uint256 timestamp
    );

    // Event emitted when ownership is transferred
    event OwnershipTransferred(
        address previousOwner,
        address newOwner
    );

    // Struct to store certificate metadata
    struct CertificateRecord {
        bytes32 certificateHash;
        address registrant;
        uint256 registeredAt;
        string metadata;
        bool revoked;
        address revokedBy;
        uint256 revokedAt;
    }

    // Mapping from certificate hash to certificate record
    mapping(bytes32 => CertificateRecord) public certificates;

    // Array to store all registered certificate hashes for enumeration
    bytes32[] public registeredHashes;

    // Mapping to track if a hash has been registered
    mapping(bytes32 => bool) public isRegistered;

    // Modifier to restrict functions to owner only
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this function");
        _;
    }

    // Modifier to check if certificate is not revoked
    modifier notRevoked(bytes32 _hash) {
        require(!certificates[_hash].revoked, "Certificate has been revoked");
        _;
    }

    /**
     * @notice Constructor sets the contract owner
     */
    constructor() {
        owner = msg.sender;
        emit OwnershipTransferred(address(0), msg.sender);
    }

    /**
     * @notice Register a new certificate hash on-chain
     * @param _certificateHash SHA256 hash of the certificate
     * @param _metadata Additional metadata (JSON string with document info)
     */
    function registerCertificate(
        bytes32 _certificateHash,
        string calldata _metadata
    ) external {
        require(!isRegistered[_certificateHash], "Certificate already registered");
        require(_certificateHash != bytes32(0), "Invalid certificate hash");

        certificates[_certificateHash] = CertificateRecord({
            certificateHash: _certificateHash,
            registrant: msg.sender,
            registeredAt: block.timestamp,
            metadata: _metadata,
            revoked: false,
            revokedBy: address(0),
            revokedAt: 0
        });

        isRegistered[_certificateHash] = true;
        registeredHashes.push(_certificateHash);

        emit CertificateRegistered(
            _certificateHash,
            msg.sender,
            block.timestamp,
            _metadata
        );
    }

    /**
     * @notice Verify if a certificate hash exists and is valid
     * @param _certificateHash SHA256 hash to verify
     * @return exists Whether the certificate is registered
     * @return valid Whether the certificate is not revoked
     * @return registeredAt Timestamp when certificate was registered
     */
    function verifyCertificate(
        bytes32 _certificateHash
    ) external view returns (
        bool exists,
        bool valid,
        uint256 registeredAt
    ) {
        CertificateRecord storage record = certificates[_certificateHash];
        exists = isRegistered[_certificateHash];
        valid = exists && !record.revoked;
        registeredAt = record.registeredAt;
    }

    /**
     * @notice Get full certificate record
     * @param _certificateHash SHA256 hash to query
     * @return record The full certificate record
     */
    function getCertificateRecord(
        bytes32 _certificateHash
    ) external view returns (CertificateRecord memory record) {
        require(isRegistered[_certificateHash], "Certificate not found");
        return certificates[_certificateHash];
    }

    /**
     * @notice Revoke a certificate (owner only)
     * @param _certificateHash SHA256 hash to revoke
     */
    function revokeCertificate(bytes32 _certificateHash) external onlyOwner {
        require(isRegistered[_certificateHash], "Certificate not found");
        require(!certificates[_certificateHash].revoked, "Certificate already revoked");

        certificates[_certificateHash].revoked = true;
        certificates[_certificateHash].revokedBy = msg.sender;
        certificates[_certificateHash].revokedAt = block.timestamp;

        emit CertificateRevoked(
            _certificateHash,
            msg.sender,
            block.timestamp
        );
    }

    /**
     * @notice Get total number of registered certificates
     * @return count Total certificates registered
     */
    function getTotalCertificates() external view returns (uint256 count) {
        return registeredHashes.length;
    }

    /**
     * @notice Get a range of registered certificate hashes
     * @param _start Start index
     * @param _end End index
     * @return hashes Array of certificate hashes
     */
    function getCertificateHashes(
        uint256 _start,
        uint256 _end
    ) external view returns (bytes32[] memory hashes) {
        require(_start <= _end, "Invalid range");
        require(_end < registeredHashes.length, "Range out of bounds");

        uint256 length = _end - _start + 1;
        hashes = new bytes32[](length);

        for (uint256 i = 0; i < length; i++) {
            hashes[i] = registeredHashes[_start + i];
        }
    }

    /**
     * @notice Transfer ownership to a new address
     * @param _newOwner Address of the new owner
     */
    function transferOwnership(address _newOwner) external onlyOwner {
        require(_newOwner != address(0), "New owner cannot be zero address");
        emit OwnershipTransferred(owner, _newOwner);
        owner = _newOwner;
    }

    /**
     * @notice Check if an address is the owner
     * @param _address Address to check
     * @return isOwner Whether the address is the owner
     */
  function isOwner(address _address) external view returns (bool) {
    return _address == owner;
  }
}
