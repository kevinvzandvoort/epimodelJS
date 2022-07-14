Big.DP = 1

let TransmissionModel = class {
  //model_states is an array with objects for each model state
  //model parameters is an array with each parameter used in the model
  //updateState is a function to model a single timestep
  //id is the HTML id for the model wrapper
  constructor(model_states, model_parameters, updateState, calculateR0, id, model_configuration) {
    this.model_states = model_states;
    this.model_parameters = model_parameters;
    this.updateState = updateState;
    this.calculateR0 = calculateR0;
    this.model_configuration = model_configuration;

    //Default configuration options
    this.configuration = new Object();
    this.model_configuration.forEach(o => {
      if(o.var == "model_plot_percentage"){
        this.configuration.plot_percentage = (o.init == 'percentage');
      } else if(o.var == "model_years"){
        this.configuration.model_days = o.init * 365;
      } else if(o.var == "model_deterministic"){
         this.configuration.model_deterministic = (o.init == 'deterministic');
      } else {
        this.configuration[o.var] = (o.init);
      }
    });
    //this.configuration.model_days = this.configuration.model_years * 365; //total days to be modelled
    //this.configuration.model_day_timesteps = 4; //number of timesteps to use per day
    //this.configuration.model_save_days = 30; //save output every x days (want to save memory)
    //this.configuration.plot_percentage = (this.model_configuration.model_plot_percentage == 'percentage'); //plot percentage or absolute number?

    //Check that all required states are present
    this.state_current = new Object;
    this.state_init = new Object;
    this.model_states.forEach(s => {
      this.state_current[s.var] = Big(parseFloat(s.init));
      this.state_init[s.var] = Big(parseFloat(s.init));
    });

    //Check that all required parameters are present
    this.parameters = new Object;
    this.params = new Object;
    this.model_parameters.forEach(p => {
      this.parameters[p.var] = p.init;
      this.params[p.var] = p.init;
    });

    //Additional summary information
    this.summary = new Object;

    //Adjust some parameters if needed
    this.adjustParams();

    //Prepare object to export values
    this.processConfig();

    //Create HTML elements
    this.model_wrapper = document.getElementById(id);
    this.createInputFields();
    this.createPlotCanvas();

    this.calculateR0();
    this.showSummary();
    this.runModel();
    this.updatePlotData();
    this.showPlot();
  }

  showSummary(){
    this.summary_block.innerHTML = "";
    if(this.summary.R0){
      let R0span = document.createElement("p");
      R0span.innerHTML = "With the selected parameter values, R0 = " + (this.summary.R0).toNumber().toFixed(2);
      this.summary_block.appendChild(R0span);
    }
  }

  createInputFields(){
    let input_fields = document.createElement("div");

    let input_parameters = document.createElement("div");
    let input_parameters_title = document.createElement("h2");
    input_parameters_title.innerHTML = "Model parameters";
    input_parameters.appendChild(input_parameters_title);
    this.model_parameters.forEach(p => {
      let label = document.createElement("label");
      label.for = label.setAttribute('for', p.var);
      label.innerHTML = p.name;

      let input = document.createElement("input");
      input.type = (p.type ? p.type : "number");
      input.name = p.var;
      input.id = p.var;
      input.value = p.init;
      input.min = p.min;
      input.max = p.max;

      input_parameters.appendChild(label);
      input_parameters.appendChild(input);
      input_parameters.appendChild(document.createElement("br"));
    });
    input_fields.appendChild(input_parameters);
    this.input_parameters = input_parameters;

    let input_states = document.createElement("div");
    let input_states_title = document.createElement("h2");
    input_states_title.innerHTML = "Initial states";
    input_states.appendChild(input_states_title);
    this.model_states.forEach(s => {
      let label = document.createElement("label");
      label.for = label.setAttribute('for', s.var);
      label.innerHTML = s.name;

      let input = document.createElement("input");
      input.type = (s.type ? s.type : "number");
      input.name = s.var;
      input.id = s.var;
      input.value = s.init;
      input.min = s.min;
      input.max = s.max;

      input_states.appendChild(label);
      input_states.appendChild(input);
      input_states.appendChild(document.createElement("br"));
    });
    input_fields.appendChild(input_states);
    this.input_states = input_states;

    let input_config = document.createElement("div");
    let input_config_title = document.createElement("h2");
    input_config_title.innerHTML = "Configuration";
    input_config.appendChild(input_config_title);
    this.model_configuration.forEach(o => {
      let label = document.createElement("label");
      if(!o.type | o.type == "number") label.setAttribute('for', o.var);
      label.innerHTML = o.name;
      input_config.appendChild(label);

      if(!o.type | o.type == "number"){
        let input = document.createElement("input");
        input.type = (o.type ? o.type : "number");
        input.name = o.var;
        input.id = o.var;
        input.value = o.init;
        input.min = o.min;
        input.max = o.max;
        input_config.appendChild(input);
      } else {
        o.options.forEach((p) => {
          let input = document.createElement("input");
          input.type = (o.type ? o.type : "number");
          input.name = o.var;
          input.id = p;
          input.value = p;
          if(p == o.init) input.checked = true;
          let input_label = document.createElement("label");
          input_label.setAttribute('for', p);
          console.log("INPUT FOR: "+p);
          input_label.innerHTML = p;
          input_config.appendChild(input);
          input_config.appendChild(input_label);
        });
      }

      input_config.appendChild(document.createElement("br"));
    });
    input_fields.appendChild(input_config);
    this.input_config = input_config;

    let update_button = document.createElement("button");
    update_button.innerHTML = "Rerun model";
    update_button.addEventListener('click', () => {
      this.updateConfig();
      this.updateStates();
      this.processConfig();
      this.updateParameters();
      this.calculateR0();
      this.showSummary();
      this.runModel();
      this.updatePlotData();
      this.showPlot();
    });

    input_fields.appendChild(update_button);
    this.model_wrapper.appendChild(input_fields);

    let summary_block = document.createElement("div");
    this.model_wrapper.appendChild(summary_block);
    this.summary_block = summary_block;
  }

  createPlotCanvas(){
    let plot_wrapper = document.createElement("div");
    plot_wrapper.className = "plot_wrapper";

    let plot_canvas = document.createElement("canvas");
    this.model_plot_id = "model_plot";
    plot_canvas.id = this.model_plot_id;

    plot_wrapper.appendChild(plot_canvas);
    this.model_wrapper.appendChild(plot_wrapper);
  }

  //Adjust model parameter
  adjustParams(){
    this.model_parameters.forEach(p => {
      switch(p.adj){
        case "/": this.params[p.var] = Big(parseFloat(this.parameters[p.var])).div(Big(this.configuration.model_day_timesteps)); break;
        case "*": this.params[p.var] = Big(parseFloat(this.parameters[p.var])).mul(Big(this.configuration.model_day_timesteps)); break;
        case "": this.params[p.var] = Big(parseFloat(this.parameters[p.var])); break;
        default: throw("Can only adjust using * or /, or use no adjustment");
      }
    });
  }

  updateStates(){
    let state_values = this.input_states.querySelectorAll("input");
    state_values.forEach((s) => {
      console.log("Updating "+ s.name + " to " + s.value);
      this.state_init[s.name] = Big(parseFloat(s.value));
    });
  }

  updateConfig(){
    let config_values = this.input_config.querySelectorAll("input");
    config_values.forEach((o) => {
      if(o.type == "radio" & !o.checked) return 0;
      console.log("Updating "+ o.name + " to " + o.value);
      if(o.name == "model_plot_percentage"){
        this.configuration.plot_percentage = (o.value == 'percentage');
      } else if(o.name == "model_years"){
        this.configuration.model_days = o.value * 365;
      } else if(o.name == "model_deterministic"){
         this.configuration.model_deterministic = (o.value == 'deterministic');
      } else {
        this.configuration[o.name] = (o.value);
      }
    });
    if(this.configuration.model_deterministic) this.configuration.model_runs = 1;
    //ensure parameters are adjusted if necessary
    this.adjustParams();
  }

  rbinom(n, prob){
    let y = 0;
    for(let i=0; i<n; i++) y += (Math.random() < prob);
    return y;
  }

  processConfig(){
    this.output = new Object();
    let total_saved_timesteps = Math.ceil(this.configuration.model_days / this.configuration.model_save_days);
    this.output.time = Array(total_saved_timesteps);
    this.output.runs = Array(this.configuration.model_runs);
    for(let r=0; r < this.configuration.model_runs; r++){
      this.output.runs[r] = new Object();
      Object.entries(this.state_init).forEach(([key, val]) => {
        this.output.runs[r][key] = Array(total_saved_timesteps);
      });
    }
  }

  updateParameters(){
    let parameter_values = this.input_parameters.querySelectorAll("input");
    parameter_values.forEach((p) => {
      console.log("Updating "+ p.name + " to " + p.value);
      this.parameters[p.name] = p.value;
    });

    //ensure parameters are adjusted if necessary
    this.adjustParams();
  }

  //Loop over all timesteps in the model
  runModel(){
    for(let i=0; i < (this.configuration.model_deterministic ? 1 : this.configuration.model_runs); i++){
      console.log("START MODEL "+(i+1)+"/"+(this.configuration.model_deterministic ? 1 : this.configuration.model_runs));
      //Note t=0 will hold initial state
      this.model_states.forEach(s => {
        this.output.runs[i][s.var][0] = this.state_init[s.var];//(isNaN(this.state_init[s.var]) ? eval(this.state_init[s.var]) : parseFloat(this.state_init[s.var]));
        this.state_current[s.var] = this.state_init[s.var];//(isNaN(this.state_init[s.var]) ? eval(this.state_init[s.var]) : parseFloat(this.state_init[s.var]));
      });

      var reported = false;
      for(let t = 1; t < (this.configuration.model_days * this.configuration.model_day_timesteps); t++){
        //potentially check to stop stochastic runs when I == 0
        this.updateState(t, this.configuration.model_deterministic, reported);

        //only save select timesteps
        let time_save_position = t / (this.configuration.model_save_days * this.configuration.model_day_timesteps);
        if(((time_save_position) % 1.0) == 0.0){
          this.model_states.forEach(s => {
            this.output.runs[i][s.var][time_save_position] = this.state_current[s.var];
          });
          reported = true;
        } else {
          reported = false;
        }
      }
      console.log("FINISH MODEL "+(i+1)+"/"+(this.configuration.model_deterministic ? 1 : this.configuration.model_runs));
    }
  }

  getModelOutput(){
    return this.output;
  }

  updatePlotData(){
    var labels = Array(Math.ceil(this.configuration.model_days / this.configuration.model_save_days));
    labels[0] = 0;
    for(let t=1; t < labels.length; t++){
      labels[t] = t*this.configuration.model_save_days;
    }
    labels = labels.slice(Math.floor((this.configuration.model_plot_start_year * 365)/this.configuration.model_save_days));

    this.plotdata = {labels: labels, datasets: []}

    var N = Big(0.0);
    this.model_states.forEach(s => {
      N = N.add(this.state_init[s.var]);
    });

    this.model_states.forEach(s => {
      if(!s.show) return 0;
      if(!this.configuration.model_plot_output.includes(s.type)) return 0

      this.output.runs.forEach((r, i)=>{
        var data = r[s.var];

        //temporarily overwrite initial value Rt
        if(s.var == "Rt"){
          data[0] = this.summary.R0.mul(this.state_init["S"]).div(this.state_init["S"].add(this.state_init["I"]).add(this.state_init["R"]));
        }

        data = data.slice(Math.floor((this.configuration.model_plot_start_year * 365)/this.configuration.model_save_days));

        if(this.configuration.model_plot_output.includes("cum")){
          var d = Big(0.0);
          for(let j = 0, length = data.length; j < length; j++){
            d = d.add(data[j]);
            data[j] = d;
          }
        }
        if(this.configuration.plot_percentage){
          for(let j = 0, length = data.length; j < length; j++){
            if(!s.nopercentage) data[j] = data[j].div(N).mul(100);
          }
        }

        //Change Big to number
        data = data.map(v => v.toNumber());

        this.plotdata.datasets.push({
          label: s.name + (this.configuration.model_runs > 1 ? " (run " + (i+1) + ")" : ""),
          backgroundColor: s.colour,
          borderColor: s.colour,
          data: data,
          yAxisID: s.yaxis
        });
      });
    });
  }

  //using ChartJS to plot results
  showPlot(){
    //destroy old plot
    if(this.hasOwnProperty("plot")) this.plot.destroy();

    this.plot = new Chart(
      document.getElementById(this.model_plot_id),
      {
        type: 'line', data: this.plotdata,
        ////stacked: false,
        options: {
          ////responsive: true,
          ////interaction: {intersect: false, mode: 'index'},
          animation: {duration: 0},
          scales: {
            left: {position: 'left', type: 'linear', title: {display: true, text: (this.configuration.plot_percentage ? "Percentage of population" : "Total number of people")}},
            right: {position: 'right', type: 'linear', title: {display: true, text: "Reproduction number"}, grid: {drawOnChartArea: false}}
          }
        }
      }
    );
  }

}

//States that are used in the model
//Colours: https://lshtm.sharepoint.com/Services/comms-eng/Documents/lshtm-brand-guidelines.pdf
let model_states = [
  {name: "Susceptible", var: "S", colour: 'rgb(0, 191, 111)', init: 100000, min: 1, max: 2000000000, show: true, type: "prevalence", yaxis: "left"}, //lightgreen
  {name: "Infectious", var: "I", colour: 'rgb(255, 184, 28)', init: 1, min: 1, max: 2000000000, show: true, type: "prevalence", yaxis: "left"}, //yellow
  {name: "Recovered", var: "R", colour: 'rgb(0, 174, 199)', init: 0, min: 0, max: 2000000000, show: true, type: "prevalence", yaxis: "left"}, //blue
  {name: "Incidence", var: "Ii", colour: 'rgb(75, 0, 45)', init: 0, min: 0, max: 0, show: true, type: "incidence", main_state: "I", yaxis: "left"}, //purple
  {name: "Reproductive number", var: "Rt", colour: 'rgb(75, 0, 45)', init: 1, min: 0, max: 0, show: true, type: "prevalence", yaxis: "right", nopercentage: true} //purple
];

//All input parameters that are used in the model
//init is the initial value
//adj specifies how value should be adjusted if timestep != 1 (* or /), leave blank for no adjustment
let model_parameters = [
  //{name: "Average number of (direct) contacts per day", var: "contacts", init: 6, adj: "/", min: 0.1, max: 50, type: "range"},
  {name: "Average number of (direct) contacts per day", var: "contacts", init: 6, adj: "/", min: 0.1, max: 50},
  {name: "Probability of transmission for each contact", var: "probtrans", init: 0.1, adj: "", min: 1/1000, max: 1},
  {name: "Average duration of infectiousness (in days)", var: "dur_inf", init: 2, adj: "*", min: 0.25, max: 365},
  {name: "Average life expectancy (in years)", var: "lexp", init: 75, adj: "*", min: 10, max: 120},
];

//All configuration options used in the model
let model_configuration = [
  {name: "Total number of years to model", var: "model_years", init: 1/12, min: 1/12, max: 100, rerun: true},
  {name: "Skip years in plot", var: "model_plot_start_year", init: 0, min: 0, max: 100, rerun: false},
  {name: "Number of modelled timesteps per day", var: "model_day_timesteps", init: 4, min: 1, max: 8, rerun: true},
  {name: "Number of modelled days that are saved", var: "model_save_days", init: 1, min: 1, max: 365, rerun: true},
  {name: "Plot output type", var: "model_plot_percentage", init: "percentage", options: ["percentage", "absolute"], rerun: false, type: "radio"},
  {name: "Plot output type", var: "model_plot_output", init: "prevalence", options: ["prevalence", "incidence", "incidence_cum"], rerun: false, type: "radio"},
  {name: "Model type", var: "model_deterministic", init: "deterministic", options: ["deterministic", "stochastic"], rerun: true, type: "radio"},
  {name: "Number of model runs (if stochastic)", var: "model_runs", init: 1, min: 1, max: 10, rerun: true},
];

//Run one timestep of the model
function updateState(t, deterministic, reported){
  if(reported) this.state_current.Ii = Big(0.0);

  let S = this.state_current.S;
  let I = this.state_current.I;
  let R = this.state_current.R;
  let N = S.add(I).add(R);

  let Rt = this.summary.R0.mul(S.div(N));

  //Note, need to convert these rates to risks
  var lambda = this.params.contacts.mul(this.params.probtrans).mul(I.div(N));
  var gamma = Big(1.0).div(this.params.dur_inf);
  var delta = Big(1.0).div(this.params.lexp.mul(Big(365.25)));

  //May need to change to Bignumber js
  //lambda = Big(1.0).sub(Math.exp(-lambda));
  //gamma = Big(1.0).sub(Math.exp(-gamma));
  //delta = Big(1.0).sub(Math.exp(-delta));

  //Assign variables for cleaner notation
  var [dS, dI, dR] = [Big(0.0), Big(0.0), Big(0.0)];
  var [S_I, I_R] = [Big(0.0), Big(0.0), Big(0.0)];

  //Transmissions and transitions
  S_I = (deterministic ? (S.mul(lambda)) : (this.rbinom(S, lambda)));
  I_R = (deterministic ? (I.mul(gamma)) : (this.rbinom(I, gamma)));

  //Difference equations
  dS = Big(0.0).sub(S_I).add(delta.mul(N.sub(S)));
  dI = S_I.sub(I_R).sub(delta.mul(I));
  dR = I_R.sub(delta.mul(R));

  //Update states
  this.state_current.S = this.state_current.S.add(dS);
  this.state_current.I = this.state_current.I.add(dI);
  this.state_current.R = this.state_current.R.add(dR);
  this.state_current.Ii = this.state_current.Ii.add(S_I); //Note, sum incidence until reported
  this.state_current.Rt = Rt; //Update Rt at every timestep
}

function calculateR0(){
  let R0 = this.params.contacts.mul(this.params.probtrans).mul(this.params.dur_inf);
  this.summary.R0 = R0;
}

let testmodel = new TransmissionModel(model_states, model_parameters, updateState, calculateR0, "model", model_configuration);
