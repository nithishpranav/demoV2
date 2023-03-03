import json
from flask import Flask, json,Response, render_template, redirect, request, session, jsonify
import requests
from flask_session import Session
from flask_socketio import SocketIO
from pymongo import MongoClient
import logging as log
from random import random
from threading import Lock
from datetime import datetime
import csv
from pathlib import Path
import pathlib
import os


import time
"""
Background Thread
"""
thread = None
thread_lock = Lock()

app = Flask(__name__)
app.config['SECRET_KEY'] = 'donsky!'
socketio = SocketIO(app, cors_allowed_origins='*')

class MongoAPI:
    def __init__(self, data):
        self.client = MongoClient("mongodb://localhost:27017/") 
        database = data['database']
        collection = data['collection']
        cursor = self.client[database]
        self.collection = cursor[collection]
        self.data = data

    def read(self):
        log.info('Reading All Data')
        documents = self.collection.find()
        output = [{item: data[item] for item in data if item != '_id'} for data in documents]
        return output

    def write(self, data):
        log.info('Writing Data')
        new_document = data['Document']
        response = self.collection.insert_one(new_document)
        output = {'Status': 'Successfully Inserted',
                  'Document_ID': str(response.inserted_id)}
        return output

def get_current_datetime():
    now = datetime.now()
    return now.strftime("%H:%M:%S")


"""
Creating a Resumeable CSV Reader
Map the machine id to the line counter 
when the machine is started, the line counter is set to 0
when the machine is stopped, the line counter is saved
when the machine is started again, the line counter is set to the saved value

"""

def background_thread():

    print("Sensor Data Thread Started...") 
    while(True):
        socketio.emit('updateSensorData', {})
        socketio.sleep(10)

"""
Serve root index file
"""
@app.route("/", methods=["POST", "GET"])
def index():
    if not session.get("userWID"):
        return redirect("/login")
    return render_template('index.html')



@app.route("/createMachine", methods=["POST", "GET"])
def createMachine():
    if not session.get("userWID"):
        return redirect("/login")
    return render_template('createMachine.html')
 
@app.route("/login", methods=["POST", "GET"])
def login():
    if request.method == "POST":
        session["userWID"] = request.form.get("userWID")
        return redirect("/")
    return render_template("login.html")
 
 
@app.route("/logout")
def logout():
    session["userWID"] = None
    session["machineID"] = None
    return redirect("/")

@app.route('/home')
def home():
    return render_template('home.html')

@app.route('/machineRegistration')
def machineRegistration():
    return render_template('machineRegistration.html')

@app.route('/machineSession', methods=["POST", "GET"])
def machineSession():
    if request.method == "POST":
        print(request.json)
        data = request.json
        machineID = data["machineID"]
        session["machineID"] = machineID
        print(machineID)
        return jsonify({})


@app.route('/machineDashboard' , methods=["POST", "GET"])
def machineDashboard():
    if(session["machineID"]):
        return render_template('machineDashboard.html')
    
@app.route('/machineTransactions' , methods=["POST", "GET"])
def machineTransactions():
    if(session["machineID"]):
        return render_template('machineTransactions.html')
    

@app.route('/getInfo' , methods=["POST", "GET"])
def getInfo():
    if request.method == "GET":
        info = {
            "machineID": session["machineID"],
            "userWID": session["userWID"]
        }
        return jsonify(info)

@app.route('/getLastTransaction/<address>', methods=["POST", "GET"])
def getLastTransaction(address):
    machineContractAddress = address
    print(machineContractAddress)
    url = "https://console.kaleido.io/api/v1/ledger/u0sdbvxn14/u0anrngbym/addresses/"+machineContractAddress+"/transactions?limit=1"
    payload={}
    headers = {
    'Authorization': 'Bearer u0bt01lis8-YaONAPbJ287Vj4FhH06clwCQRse+dPwwKrPhlpuWpkQ='
    }
    response = requests.request("GET", url, headers=headers, data=payload)
    print(response.json)
    return response.json()


@app.route('/lastMachineMetricsDate', methods=["POST", "GET"])
def lastMachineMetrics():
    machineID = session["machineID"]
    dateFile = pathlib.Path("./state/"+machineID+"date.csv")

    if(dateFile.exists()):
        f = open(dateFile, 'r')
        date = f.readline()
        f.close()
    else:
        f = open(dateFile, 'w')
        f.write("2021-01-01 00") 
        f.close()
        date = "2021-01-01 00"

    if request.method == "GET":
        info = {
            "date": date
        }
        return jsonify(info)


@app.route('/updateMachineMetricsDate', methods=["POST", "GET"])
def updateMachineMetricsDate():
    
    if request.method == "POST":
        print(request.json)
        data = request.json
        date = data["time_stamp"]
        print(date)
        machineID = session["machineID"]
        dateFile = pathlib.Path("./state/"+machineID+"date.csv")
        f = open(dateFile, 'w')
        f.write(date)
        f.close()
        return jsonify({})

    


"""
Decorator for connect
"""
@socketio.on('connect')
def connect():
    global thread
    print('Client connected')
    
    global thread
    with thread_lock:
        if thread is None:
            thread = socketio.start_background_task(background_thread)


"""
Decorator for disconnect
"""
@socketio.on('disconnect')
def disconnect():

    print('Client disconnected',  request.sid)

"""
Database API
    Dashboard Page API
    Transaction Page API
"""

"""
Dashboard Page API
"""


"""
Transaction Page API
    read machine usage from database using Machine Contract Address
"""
#read machine usage from database using Machine Contract Address
@app.route('/getTransactions', methods=['POST'])
def mongo_read():
    data = request.json
    dataJson = jsonify(data)
    filter = data["filter"]
    print(filter["machineID"])
    #print(dataJson)
    if data is None or data == {}:
        return Response(response=json.dumps({"Error": "Please provide connection information"}),
                        status=400,
                        mimetype='application/json')
    obj1 = MongoAPI(data)
    response = obj1.read()
    result = []
    for x in response:
        for key, value in x.items():
            if(key == "jsonStr"):
                print(type(value))
                if isinstance(value, dict):
                    if(value.get('machineID') == filter["machineID"]):
                        print(value.get('machineID'))
                        result.append(x)
                        continue
                else:
                    print('The value is NOT a dictionary')
    return Response(response=json.dumps(result),
                    status=200,
                    mimetype='application/json')


#write machine usage to database
@app.route('/mongodb', methods=['POST'])
def mongo_write():
    data = request.json
    if data is None or data == {} or 'Document' not in data:
        return Response(response=json.dumps({"Error": "Please provide connection information"}),
                        status=400,
                        mimetype='application/json')
    obj1 = MongoAPI(data)
    response = obj1.write(data)
    return Response(response=json.dumps(response),
                    status=200,
                    mimetype='application/json')

"""
Main function
"""

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(debug=True, host='0.0.0.0', port=port)