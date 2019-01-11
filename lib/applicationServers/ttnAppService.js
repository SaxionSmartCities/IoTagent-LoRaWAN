/*
 * Copyright 2019 Atos Spain S.A
 *
 * This file is part of iotagent-lora
 *
 * iotagent-lora is free software: you can redistribute it and/or
 * modify it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the License,
 * or (at your option) any later version.
 *
 * iotagent-lora is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 * See the GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public
 * License along with iotagent-lora.
 * If not, seehttp://www.gnu.org/licenses/.
 *
 */

'use strict';

var winston = require('winston');
var appService = require('./abstractAppService');
var mqttClient = require('../bindings/mqttClient');

/**
 *Class that represents a TTN LoRaWAN app server
 */
class TtnAppService extends appService.AbstractAppService {
    /**
     * Constructs the object.
     *
     * @param      {String}  applicationServer  The application server
     * @param      {String}  appEui             The application eui
     * @param      {String}  applicationId      The application identifier
     * @param      {String}  applicationKey     The application key
     * @param      {Function}  messageHandler     The message handler
     * @param      {String}  dataModel     The data model
     * @param      {Object}  iotaConfiguration     The IOTA configuration associated to this Application Server.
     */
    constructor (applicationServer, appEui, applicationId, applicationKey, messageHandler, dataModel, iotaConfiguration) {
        if (!applicationId) {
            throw new Error('applicationId is mandatory for TTN');
        }

        super(applicationServer, appEui, applicationId, applicationKey, messageHandler, dataModel, iotaConfiguration);
    }

    /**
     * It starts the TTN Application Service interface
     *
     * @param      {Function}  callback  The callback
     */
    start (callback) {
        this.preProcessMessage = this.preProcessMessage.bind(this);
        this.mqttClient = new mqttClient.MqttClient(
            this.applicationServer.host,
            this.applicationServer.username,
            this.applicationServer.password,
            this.preProcessMessage);

        this.mqttClient.start(function () {
            // Ignore useless callback
        });
        callback();
    };

    /**
     * It stops the TTN Application Service interface
     *
     * @param      {Function}  callback  The callback
     */
    stop (callback) {
        this.stopObserveAllDevices();
        this.mqttClient.stop(callback);
    }

    /**
     * It processes a message received from a TTN Application Service
     * The following fields are present in the JSON message:
     * app_id (human readable application id)
     * dev_id (human readable device id)
     * hardware_serial (the device EUI)
     * counter
     * port
     * metadata (time, latitude, longitude, altitude)
     * payload_raw (encoded payload)
     * payload_fields (decoded payload)
     *
     * @param      {<type>}  mqttTopic  The mqtt topic: <application_id>/devices/<device_id)/up
     * @param      {<type>}  message    The message in JSON format
     */
    preProcessMessage (mqttTopic, message) {
        winston.info('New message in topic', mqttTopic);
        var splittedMqttTopic = mqttTopic.split('/');
        if (splittedMqttTopic.length !== 4) {
            var errorMessage = 'Bad format for a TTN topic';
            winston.error(errorMessage);
        } else {
            // var appId = splittedMqttTopic[0];
            try {
                message = JSON.parse(message);
            } catch (e) {
                winston.error('Error decoding message:' + e);
                message = null;
                return;
            }

            var dataModel = this.getDataModel(message.dev_id, null);

            var payload = null;
            if (dataModel === 'application_server' && message['payload_fields']) {
                payload = message['payload_fields'];
            } else if (message['payload_raw']) {
                payload = message['payload_raw'];
            }
            this.messageHandler(this, message.dev_id, message.hardware_serial, payload);
        }
    }

    /**
     * It observes a new device. Abstract method
     *
     * @param      {string}  devId         The development identifier
     * @param      {String}  devEUI         The development identifier
     * @param      {<type>}  deviceObject  The device object
     */
    observeDevice (devId, devEUI, deviceObject) {
        var mqttTopic = this.applicationId + '/devices/' + devId + '/up';
        this.mqttClient.subscribeTopic(mqttTopic);
        winston.info('Mqtt topic subscribed:%s', mqttTopic);
    }

    /**
     * It stops observing a device. Abstract method
     *
     * @param      {string}  devId         The development identifier
     * @param      {String}  devEUI         The development identifier
     * @param      {<type>}  deviceObject  The device object
     */
    stopObservingDevice (devId, devEUI, deviceObject) {
        var mqttTopic = this.applicationId + '/devices/' + devId + '/up';
        this.mqttClient.unSubscribeTopic(mqttTopic);
        winston.info('Mqtt topic unsubscribed:%s', mqttTopic);
    }

    /**
     * It observes all devices
     */
    observeAllDevices () {
        var mqttTopic = this.applicationId + '/devices/+/up';
        this.mqttClient.subscribeTopic(mqttTopic);
        winston.info('Mqtt topic subscribed:%s', mqttTopic);
    }

    /**
     * It stops observing all devices.
     */
    stopObserveAllDevices () {
        var mqttTopic = this.applicationId + '/devices/+/up';
        this.mqttClient.unSubscribeTopic(mqttTopic);
        winston.info('Mqtt topic unsubscribed:%s', mqttTopic);
    }
};

exports.TtnAppService = TtnAppService;
