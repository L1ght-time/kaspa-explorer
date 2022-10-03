/* global BigInt */

import moment from "moment";
import { useContext, useEffect, useRef, useState } from 'react';
import { Col, Container, OverlayTrigger, Row, Spinner, Tooltip } from "react-bootstrap";
import { BiNetworkChart } from "react-icons/bi";
import { useParams } from "react-router";
import { Link } from "react-router-dom";
import { parsePayload } from "../bech32.js";
import { numberWithCommas } from "../helper.js";
import { getBlock, getTransaction, getTransactions } from '../kaspa-api-client.js';
import BlueScoreContext from "./BlueScoreContext.js";
import CopyButton from "./CopyButton.js";
import PriceContext from "./PriceContext.js";


const TransactionInfo = () => {
    const { id } = useParams();
    const [txInfo, setTxInfo] = useState()
    const [additionalTxInfo, setAdditionalTxInfo] = useState()
    const [minerName, setMinerName] = useState()
    const [minerAddress, setMinerAddress] = useState()
    const [isBlueBlock, setIsBlueBlock] = useState(null)
    const [error, setError] = useState(false)
    const { price } = useContext(PriceContext);
    const retryCnt = useRef(0)
    const { blueScore } = useContext(BlueScoreContext);

    const [blockColor, setBlockColor] = useState()

    const getTx = () => getTransaction(id).then(
        (res) => {
            setTxInfo(res)
        })
        .catch((err) => {
            setError(true);
            setTxInfo(undefined);
            throw err
        })

    useEffect(() => {
        setError(false);
        getTx()
    }, [id])

    const getAddrFromOutputs = (outputs, i) => {
        for (const o of outputs) {
            if (o.index == i) {
                return o.scriptPublicKeyAddress
            }
        }
    }
    const getAmountFromOutputs = (outputs, i) => {
        for (const o of outputs) {
            if (o.index == i) {
                return o.amount / 100000000
            }
        }
    }

    useEffect(() => {
        // request TX input addresses
        if (!!txInfo && txInfo?.detail != "Transaction not found") {
            const txToQuery = txInfo.inputs?.flatMap(txInput => txInput.previous_outpoint_hash).filter(x => x)
            console.log("q", txToQuery)
            if (!!txToQuery) {
                getTransactions(txToQuery, true, true).then(
                    resp => {
                        const respAsObj = resp.reduce((obj, cur) => {
                            obj[cur["transaction_id"]] = cur
                            return obj;
                        }, {});
                        console.log(respAsObj)
                        setAdditionalTxInfo(respAsObj)
                    }
                ).catch(err => console.log("Error ", err))
            }
        }
        if (txInfo?.detail == "Transaction not found") {
            retryCnt.current += 1
            if (retryCnt.current < 10) {
                setTimeout(getTx(), 1000);
                console.log("retry", retryCnt)
            }
        }
    }, [txInfo])


    return <div className="blockinfo-page">
        <Container className="webpage" fluid>
            <Row>
                <Col className="mx-0">
                    {!!txInfo && txInfo?.detail != "Transaction not found" ?
                        <div className="blockinfo-content">
                            <div className="blockinfo-header"><h4 className="d-flex flex-row align-items-center">transaction info</h4></div>
                            <Container className="blockinfo-table mx-0" fluid>
                                <Row className="blockinfo-row">
                                    <Col className="blockinfo-key" lg={2}>Transaction Id</Col>
                                    <Col className="blockinfo-value-mono" lg={10}>{txInfo.transaction_id}
                                        <CopyButton text={txInfo.transaction_id} />
                                    </Col>
                                </Row>
                                <Row className="blockinfo-row">
                                    <Col className="blockinfo-key" lg={2}>Subnetwork Id</Col>
                                    <Col className="blockinfo-value-mono" lg={10}>{txInfo.subnetwork_id}</Col>
                                </Row>
                                <Row className="blockinfo-row">
                                    <Col className="blockinfo-key" lg={2}>Hash</Col>
                                    <Col className="blockinfo-value-mono" lg={10}>{txInfo.hash}</Col>
                                </Row>
                                <Row className="blockinfo-row">
                                    <Col className="blockinfo-key" lg={2}>Mass</Col>
                                    <Col className="blockinfo-value" lg={10}>{txInfo.mass ? txInfo.mass : "-"}</Col>
                                </Row>
                                <Row className="blockinfo-row">
                                    <Col className="blockinfo-key" lg={2}>Block Hashes</Col>
                                    <Col className="blockinfo-value-mono" lg={10}><ul>{txInfo.block_hash?.map(x => <li>
                                        <Link to={`/blocks/${x}`} className="blockinfo-link">{x}</Link>
                                    </li>)}</ul></Col>
                                </Row>
                                <Row className="blockinfo-row">
                                    <Col className="blockinfo-key" lg={2}>Block Time</Col>
                                    <Col className="blockinfo-value" lg={10}>{moment(parseInt(txInfo.block_time)).format("YYYY-MM-DD HH:mm:ss")} ({txInfo.block_time})</Col>
                                </Row>
                                <Row className="blockinfo-row">
                                    <Col className="blockinfo-key" lg={2}>Accepting Block Hash</Col>
                                    <Col className="blockinfo-value-mono" lg={10}>
                                        <Link to={`/blocks/${txInfo.accepted_block_hash}`} className="blockinfo-link">
                                            {txInfo.accepted_block_hash || "-"}
                                        </Link>
                                    </Col>
                                </Row>
                                <Row className="blockinfo-row border-bottom-0">
                                    <Col className="blockinfo-key" md={2}>Details</Col>
                                    <Col className="blockinfo-value mt-2 d-flex flex-row flex-wrap" md={10} lg={10} style={{marginBottom: "-1rem"}}>
                                        {txInfo.is_accepted ? <div className="accepted-true me-3 mb-3">accepted</div> :
                                            <span className="accepted-false me-">not accepted</span>}
                                        {txInfo.is_accepted && blueScore !== 0 && (blueScore - txInfo.accepted_block_blue_score) < 86400 && <div className="confirmations mb-3">{blueScore - txInfo.accepted_block_blue_score}&nbsp;confirmations</div>}
                                        {txInfo.is_accepted && blueScore !== 0 && (blueScore - txInfo.accepted_block_blue_score) >= 86400 && <div className="confirmations mb-3">confirmed</div>}
                                    </Col>
                                </Row>
                            </Container>
                        </div> : <><Spinner animation="border" variant="primary" /><h2 className="text-light">Loading...</h2></>}
                </Col>
            </Row>

            {/* id = Column(Integer, primary_key=True)
    transaction_id = Column(String)
    index = Column(Integer)

    previous_outpoint_hash = Column(String)  # "ebf6da83db96d312a107a2ced19a01823894c9d7072ed0d696a9a152fd81485e"
    previous_outpoint_index = Column(String)  # "ebf6da83db96d312a107a2ced19a01823894c9d7072ed0d696a9a152fd81485e"

    signatureScript = Column(String)  # "41c903159094....281a1d26f70b0037d600554e01",
    sigOpCount = Column(Integer) */}

            <Row>
                <Col>
                    {!!txInfo && txInfo?.detail != "Transaction not found" ?
                        <div className="blockinfo-content mt-4 mb-5">
                            <div className="blockinfo-header"><h4>Inputs</h4></div>
                            <Container className="webpage utxo-box" fluid>
                                {
                                    (txInfo.inputs || []).map((tx_input) => <>
                                        <Row className="utxo-border py-3">
                                            <Col sm={6} md={6} lg={2}>
                                                <div className="blockinfo-key mt-0 mt-md-2">Signature Op Count</div>
                                                <div className="utxo-value-mono">
                                                    {tx_input.sigOpCount}
                                                </div>
                                            </Col>
                                            <Col sm={12} md={12} lg={7}>
                                                <div className="blockinfo-key mt-2">Signature Script</div>
                                                <div className="utxo-value-mono">
                                                    {tx_input.signatureScript}
                                                </div>
                                            </Col>
                                            {!!additionalTxInfo && additionalTxInfo[tx_input.previous_outpoint_hash] && <Col sm={12} md={12} lg={3}>
                                                <div className="blockinfo-key mt-2">Amount</div>
                                                <div className="utxo-value">
                                                    <span className="utxo-amount-minus">-{additionalTxInfo[tx_input.previous_outpoint_hash]
                                                        .outputs[tx_input.previous_outpoint_index].amount / 100000000}&nbsp;KAS</span>
                                                </div>
                                            </Col>}
                                            <Col sm={12} md={12} lg={12}>
                                                <div className="blockinfo-key mt-2">Previous Outpoint Index + Hash</div>
                                                <div className="utxo-value-mono">
                                                    #{tx_input.previous_outpoint_index} {tx_input.previous_outpoint_hash}
                                                </div>
                                            </Col>
                                            {additionalTxInfo && additionalTxInfo[tx_input.previous_outpoint_hash] && <>
                                                <Col sm={12} md={12} lg={12}>
                                                    <div className="blockinfo-key mt-2">Address</div>
                                                    <div className="utxo-value-mono">
                                                        <Link to={`/addresses/${additionalTxInfo[tx_input.previous_outpoint_hash]
                                                            .outputs[tx_input.previous_outpoint_index].scriptPublicKeyAddress}`} className="blockinfo-link">
                                                            {additionalTxInfo[tx_input.previous_outpoint_hash]
                                                                .outputs[tx_input.previous_outpoint_index].scriptPublicKeyAddress}
                                                        </Link>
                                                    </div>
                                                </Col></>}
                                        </Row>

                                    </>)
                                }

                            </Container>
                            <div className="blockinfo-header mt-5"><h4>Outputs</h4></div>
                            <Container className="webpage utxo-box" fluid>
                                {
                                    (txInfo.outputs || []).map((tx_output) =>
                                        <Row className="utxo-border py-3">
                                            <Col sm={6} md={6} lg={2}>
                                                <div className="blockinfo-key mt-2 mt-lg-0">Index</div>
                                                <div className="utxo-value-mono">
                                                    #{tx_output.index}
                                                </div>
                                            </Col>
                                            <Col sm={12} md={12} lg={7}>
                                                <div className="blockinfo-key mt-2 mt-lg-0">Script Public Key Type</div>
                                                <div className="utxo-value-mono">
                                                    {tx_output.scriptPublicKeyType}
                                                </div>
                                            </Col>
                                            <Col sm={6} md={6} lg={3}>
                                                <div className="blockinfo-key mt-2 mt-lg-0">Amount</div>
                                                <div className="utxo-value">
                                                    <span className="utxo-amount">+{tx_output.amount / 100000000}&nbsp;KAS</span>
                                                </div>
                                            </Col>
                                            <Col sm={12} md={12} lg={12}>
                                                <div className="blockinfo-key mt-2">Script Public Key</div>
                                                <div className="utxo-value-mono">
                                                    {tx_output.scriptPublicKey}
                                                </div>
                                            </Col>
                                            <Col sm={12} md={12} lg={12}>
                                                <div className="blockinfo-key mt-2">Script Public Key Address</div>
                                                <div className="utxo-value-mono">

                                                    <Link to={`/addresses/${tx_output.scriptPublicKeyAddress}`} className="blockinfo-link">
                                                        {tx_output.scriptPublicKeyAddress}
                                                    </Link>
                                                </div>
                                            </Col>
                                        </Row>)
                                }
                            </Container></div> : <></>}
                </Col>
            </Row>

        </Container>
    </div >



}

export default TransactionInfo;
